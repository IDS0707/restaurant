package handlers

import (
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type CreateOrderRequest struct {
	Items             []OrderItemReq `json:"items" binding:"required"`
	CardCode          string         `json:"card_code"`
	Note              string         `json:"note"`
	CustomerFirstName string         `json:"customer_first_name"`
	CustomerLastName  string         `json:"customer_last_name"`
	CustomerPhone     string         `json:"customer_phone"`
	DeliveryType      string         `json:"delivery_type"` // 'delivery' | 'pickup'
	DeliveryAddress   string         `json:"delivery_address"`
	DeliveryLat       *float64       `json:"delivery_lat"`
	DeliveryLng       *float64       `json:"delivery_lng"`
}

type OrderItemReq struct {
	MenuItemID int `json:"menu_item_id" binding:"required"`
	Quantity   int `json:"quantity" binding:"required"`
}

func generateOrderCode() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%06d", rand.Intn(900000)+100000)
}

func CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// If the caller is a signed-in customer (token resolved by ResolveCustomerOptional),
	// attach the customer's id and prefer the stored phone/name when fields are blank.
	var customerID int
	if v, ok := c.Get("customer_id"); ok {
		if cid, ok2 := v.(int); ok2 && cid > 0 {
			customerID = cid
			var first, last, phone string
			database.DB.QueryRow(
				`SELECT first_name, COALESCE(last_name,''), phone FROM customers WHERE id=$1`, cid,
			).Scan(&first, &last, &phone)
			if req.CustomerFirstName == "" {
				req.CustomerFirstName = first
			}
			if req.CustomerLastName == "" {
				req.CustomerLastName = last
			}
			if req.CustomerPhone == "" {
				req.CustomerPhone = phone
			}
		}
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}
	defer tx.Rollback()

	var totalPrice float64
	var orderItems []models.OrderItem

	for _, item := range req.Items {
		var price float64
		var name string
		err := tx.QueryRow(`SELECT price, name FROM menu_items WHERE id=$1 AND available=true`, item.MenuItemID).Scan(&price, &name)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Menu item %d not found or unavailable", item.MenuItemID)})
			return
		}
		totalPrice += price * float64(item.Quantity)
		orderItems = append(orderItems, models.OrderItem{
			MenuItemID: item.MenuItemID,
			ItemName:   name,
			Quantity:   item.Quantity,
			UnitPrice:  price,
		})
	}

	// ─── Проверка наличия ингредиентов на складе ───────────────────────────
	type ingNeed struct {
		name    string
		unit    string
		need    float64
		inStock float64
	}
	needs := map[int]*ingNeed{}

	for _, item := range req.Items {
		rrows, qerr := tx.Query(`
			SELECT ri.ingredient_id, ri.quantity_used, ri.unit,
			       i.name, i.measurement_unit, i.quantity
			FROM recipe_items ri
			JOIN ingredients i ON ri.ingredient_id = i.id
			WHERE ri.menu_item_id = $1
		`, item.MenuItemID)
		if qerr != nil {
			continue
		}
		for rrows.Next() {
			var ingID int
			var qtyUsed, stock float64
			var recipeUnit, ingName, ingUnit string
			rrows.Scan(&ingID, &qtyUsed, &recipeUnit, &ingName, &ingUnit, &stock)
			required := unitCostFactor(qtyUsed*float64(item.Quantity), recipeUnit, ingUnit)
			if existing, ok := needs[ingID]; ok {
				existing.need += required
			} else {
				needs[ingID] = &ingNeed{name: ingName, unit: ingUnit, need: required, inStock: stock}
			}
		}
		rrows.Close()
	}

	var shortages []string
	for _, n := range needs {
		if n.need > n.inStock {
			shortages = append(shortages, fmt.Sprintf("%s (керак: %.2f %s, мавжуд: %.2f %s)",
				n.name, n.need, n.unit, n.inStock, n.unit))
		}
	}

	if len(shortages) > 0 {
		// Сохраняем заказ со статусом "rejected" (Отказ); склад не уменьшаем.
		var rejectedCode string
		for {
			rejectedCode = generateOrderCode()
			var exists bool
			tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM orders WHERE order_code=$1)`, rejectedCode).Scan(&exists)
			if !exists {
				break
			}
		}

		var rejectedID int
		dtype := req.DeliveryType
		if dtype == "" {
			dtype = "pickup"
		}
		var custIDArg interface{}
		if customerID > 0 {
			custIDArg = customerID
		}
		insErr := tx.QueryRow(
			`INSERT INTO orders
			   (order_code, total_price, discount_amount, final_price, status, card_code, note,
			    customer_first_name, customer_last_name, customer_phone,
			    delivery_type, delivery_address, delivery_lat, delivery_lng, customer_id)
			 VALUES ($1,$2,0,$2,'rejected',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
			rejectedCode, totalPrice, req.CardCode, req.Note,
			req.CustomerFirstName, req.CustomerLastName, req.CustomerPhone,
			dtype, req.DeliveryAddress, req.DeliveryLat, req.DeliveryLng, custIDArg,
		).Scan(&rejectedID)
		if insErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": insErr.Error()})
			return
		}

		for i := range orderItems {
			tx.Exec(
				`INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price)
				 VALUES ($1,$2,$3,$4,$5)`,
				rejectedID, orderItems[i].MenuItemID, orderItems[i].ItemName,
				orderItems[i].Quantity, orderItems[i].UnitPrice,
			)
		}

		if cmtErr := tx.Commit(); cmtErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "Омборда ингредиентлар етарли эмас: " + strings.Join(shortages, "; "),
			"status":     "rejected",
			"order_code": rejectedCode,
			"shortages":  shortages,
		})
		return
	}

	var discountAmount float64
	var cardAgentID int
	var cardID int

	if req.CardCode != "" {
		discountAmount, cardAgentID, cardID, err = applyCardDiscount(tx, req.CardCode, totalPrice)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	finalPrice := totalPrice - discountAmount
	if finalPrice < 0 {
		finalPrice = 0
	}

	var orderCode string
	for {
		orderCode = generateOrderCode()
		var exists bool
		tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM orders WHERE order_code=$1)`, orderCode).Scan(&exists)
		if !exists {
			break
		}
	}

	var orderID int
	dtype := req.DeliveryType
	if dtype == "" {
		dtype = "pickup"
	}
	var custIDArg interface{}
	if customerID > 0 {
		custIDArg = customerID
	}
	err = tx.QueryRow(
		`INSERT INTO orders
		   (order_code, total_price, discount_amount, final_price, status, card_code, note,
		    customer_first_name, customer_last_name, customer_phone,
		    delivery_type, delivery_address, delivery_lat, delivery_lng, customer_id)
		 VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
		orderCode, totalPrice, discountAmount, finalPrice, req.CardCode, req.Note,
		req.CustomerFirstName, req.CustomerLastName, req.CustomerPhone,
		dtype, req.DeliveryAddress, req.DeliveryLat, req.DeliveryLng, custIDArg,
	).Scan(&orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range orderItems {
		var itemID int
		tx.QueryRow(
			`INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price)
			 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			orderID, orderItems[i].MenuItemID, orderItems[i].ItemName, orderItems[i].Quantity, orderItems[i].UnitPrice,
		).Scan(&itemID)
		orderItems[i].ID = itemID
		orderItems[i].OrderID = orderID
	}

	if req.CardCode != "" && cardID > 0 {
		tx.Exec(
			`INSERT INTO card_transactions (card_id, order_id, agent_id, discount_applied) VALUES ($1,$2,$3,$4)`,
			cardID, orderID, cardAgentID, discountAmount,
		)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
		return
	}

	if req.CardCode != "" && cardID > 0 {
		checkAndGrantBonus(cardID, cardAgentID)
	}

	order := models.Order{
		ID:             orderID,
		OrderCode:      orderCode,
		TotalPrice:     totalPrice,
		DiscountAmount: discountAmount,
		FinalPrice:     finalPrice,
		Status:         "pending",
		CardCode:       req.CardCode,
		Note:           req.Note,
		Items:          orderItems,
		CreatedAt:      time.Now(),
	}

	BroadcastMessage("new_order", order)
	c.JSON(http.StatusCreated, order)
}

func applyCardDiscount(tx *sql.Tx, cardCode string, totalPrice float64) (float64, int, int, error) {
	var cardID, agentID int
	var cardType string
	var useCount int
	var isActive bool
	err := tx.QueryRow(
		`SELECT rc.id, rc.agent_id, rc.card_type, rc.use_count, rc.is_active
		 FROM referral_cards rc WHERE rc.card_code=$1`, cardCode,
	).Scan(&cardID, &agentID, &cardType, &useCount, &isActive)
	if err != nil {
		// Try VIP card (full order = free)
		var vipID int
		var vipActive bool
		vipErr := tx.QueryRow(
			`SELECT id, is_active FROM vip_cards WHERE code=$1`, cardCode,
		).Scan(&vipID, &vipActive)
		if vipErr == nil {
			if !vipActive {
				return 0, 0, 0, fmt.Errorf("VIP karta deaktivlashtirilgan")
			}
			// Increment use count (no limit on VIP)
			tx.Exec(`UPDATE vip_cards SET use_count = use_count + 1 WHERE id=$1`, vipID)
			return totalPrice, 0, 0, nil // discount = totalPrice → final 0
		}

		// Try promo discount code (separate global QR managed in admin) — case-insensitive
		var promoID int
		var promoDiscount float64
		var promoType string
		var promoActive bool
		var promoLimit, promoUseCount int
		var promoValidUntil *time.Time
		promoErr := tx.QueryRow(
			`SELECT id, discount_amount, COALESCE(discount_type,'amount'), is_active,
			        COALESCE(usage_limit,0), COALESCE(use_count,0), valid_until
			 FROM promo_discount WHERE UPPER(code)=UPPER($1)`, cardCode,
		).Scan(&promoID, &promoDiscount, &promoType, &promoActive, &promoLimit, &promoUseCount, &promoValidUntil)
		if promoErr != nil {
			return 0, 0, 0, fmt.Errorf("card not found")
		}
		if !promoActive {
			return 0, 0, 0, fmt.Errorf("Promo deaktivlashtirilgan")
		}
		if promoValidUntil != nil && time.Now().After(*promoValidUntil) {
			return 0, 0, 0, fmt.Errorf("Promo muddati tugagan")
		}
		if promoLimit > 0 && promoUseCount >= promoLimit {
			return 0, 0, 0, fmt.Errorf("Promo muddati tugagan")
		}
		// Atomic increment with limit + validity guard
		res, errInc := tx.Exec(
			`UPDATE promo_discount SET use_count = use_count + 1
			 WHERE id=$1 AND is_active=true
			 AND (usage_limit = 0 OR use_count < usage_limit)
			 AND (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP)`,
			promoID,
		)
		if errInc != nil {
			return 0, 0, 0, fmt.Errorf("promo update failed")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return 0, 0, 0, fmt.Errorf("Promo muddati tugagan")
		}
		var discount float64
		if promoType == "percent" {
			discount = totalPrice * promoDiscount / 100.0
		} else {
			discount = promoDiscount
		}
		if discount > totalPrice {
			discount = totalPrice
		}
		return discount, 0, 0, nil
	}
	if !isActive {
		return 0, 0, 0, fmt.Errorf("card is inactive")
	}

	var discountAmount float64
	var bonusThreshold int
	tx.QueryRow(
		`SELECT discount_amount, bonus_threshold FROM referral_agents WHERE id=$1`, agentID,
	).Scan(&discountAmount, &bonusThreshold)

	var discount float64

	if cardType == "gold" {
		discount = discountAmount
		if discount > totalPrice {
			discount = totalPrice
		}
		tx.Exec(`UPDATE referral_cards SET use_count=use_count+1 WHERE id=$1`, cardID)
		tx.Exec(`UPDATE referral_agents SET gold_card_uses=gold_card_uses+1 WHERE id=$1`, agentID)
	} else {
		discount = discountAmount * 0.05
		if discount > totalPrice {
			discount = totalPrice
		}
		tx.Exec(`UPDATE referral_cards SET use_count=use_count+1 WHERE id=$1`, cardID)
		tx.Exec(`UPDATE referral_agents SET referral_card_total_uses=referral_card_total_uses+1 WHERE id=$1`, agentID)
	}

	return discount, agentID, cardID, nil
}

func checkAndGrantBonus(cardID, agentID int) {
	var cardType string
	var goldUses, referralUses, bonusThreshold, referralBonusThreshold int
	var discountAmount float64

	database.DB.QueryRow(
		`SELECT rc.card_type, ra.gold_card_uses, ra.referral_card_total_uses,
		        ra.bonus_threshold, ra.referral_bonus_threshold, ra.discount_amount
		 FROM referral_cards rc
		 JOIN referral_agents ra ON rc.agent_id=ra.id
		 WHERE rc.id=$1`, cardID,
	).Scan(&cardType, &goldUses, &referralUses, &bonusThreshold, &referralBonusThreshold, &discountAmount)

	if cardType == "gold" && goldUses > 0 && goldUses%bonusThreshold == 0 {
		database.DB.Exec(
			`INSERT INTO agent_bonuses (agent_id, bonus_type, amount, description)
			 VALUES ($1,'gold_meal',$2,'Бонус за %d визитов с золотой картой')`,
			agentID, discountAmount, goldUses,
		)
		database.DB.Exec(`UPDATE referral_agents SET total_bonus_earned=total_bonus_earned+1 WHERE id=$1`, agentID)
		BroadcastMessage("agent_bonus", gin.H{"agent_id": agentID, "type": "gold_meal"})
	}

	if cardType == "regular" && referralUses > 0 && referralUses%referralBonusThreshold == 0 {
		database.DB.Exec(
			`INSERT INTO agent_bonuses (agent_id, bonus_type, amount, description)
			 VALUES ($1,'referral_meal',$2,'Бонус за %d реферальных визитов')`,
			agentID, discountAmount, referralUses,
		)
		database.DB.Exec(`UPDATE referral_agents SET total_bonus_earned=total_bonus_earned+1 WHERE id=$1`, agentID)
		BroadcastMessage("agent_bonus", gin.H{"agent_id": agentID, "type": "referral_meal"})
	}
}

func GetOrders(c *gin.Context) {
	status := c.Query("status")
	whereClause := ""
	args := []interface{}{}
	if status != "" {
		whereClause = " WHERE status=$1"
		args = append(args, status)
	}

	orderQuery := `SELECT id, order_code, total_price, discount_amount, final_price, status,
	               COALESCE(card_code,''), COALESCE(note,''),
	               COALESCE(customer_first_name,''), COALESCE(customer_last_name,''),
	               COALESCE(customer_phone,''), COALESCE(delivery_type,'pickup'),
	               COALESCE(delivery_address,''), delivery_lat, delivery_lng,
	               created_at, updated_at
	               FROM orders` + whereClause + ` ORDER BY created_at DESC LIMIT 200`

	rows, err := database.DB.Query(orderQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	orders := []models.Order{}
	orderMap := map[int]int{}
	for rows.Next() {
		var o models.Order
		rows.Scan(&o.ID, &o.OrderCode, &o.TotalPrice, &o.DiscountAmount, &o.FinalPrice,
			&o.Status, &o.CardCode, &o.Note,
			&o.CustomerFirstName, &o.CustomerLastName, &o.CustomerPhone,
			&o.DeliveryType, &o.DeliveryAddress, &o.DeliveryLat, &o.DeliveryLng,
			&o.CreatedAt, &o.UpdatedAt)
		o.Items = []models.OrderItem{}
		orderMap[o.ID] = len(orders)
		orders = append(orders, o)
	}

	if len(orders) > 0 {
		itemQuery := `SELECT oi.order_id, oi.id, COALESCE(oi.menu_item_id, 0), oi.item_name, oi.quantity, oi.unit_price
		              FROM order_items oi
		              WHERE oi.order_id IN (
		                  SELECT id FROM orders` + whereClause + ` ORDER BY created_at DESC LIMIT 200
		              )`
		itemRows, err := database.DB.Query(itemQuery, args...)
		if err == nil {
			defer itemRows.Close()
			for itemRows.Next() {
				var orderID int
				var item models.OrderItem
				itemRows.Scan(&orderID, &item.ID, &item.MenuItemID, &item.ItemName, &item.Quantity, &item.UnitPrice)
				item.OrderID = orderID
				if idx, ok := orderMap[orderID]; ok {
					orders[idx].Items = append(orders[idx].Items, item)
				}
			}
		}
	}

	c.JSON(http.StatusOK, orders)
}

func GetOrderByCode(c *gin.Context) {
	code := c.Param("code")
	var o models.Order
	err := database.DB.QueryRow(
		`SELECT id, order_code, total_price, discount_amount, final_price, status,
		 COALESCE(card_code,''), COALESCE(note,''),
		 COALESCE(customer_first_name,''), COALESCE(customer_last_name,''),
		 COALESCE(customer_phone,''), COALESCE(delivery_type,'pickup'),
		 COALESCE(delivery_address,''), delivery_lat, delivery_lng,
		 created_at, updated_at
		 FROM orders WHERE order_code=$1`, code,
	).Scan(&o.ID, &o.OrderCode, &o.TotalPrice, &o.DiscountAmount, &o.FinalPrice,
		&o.Status, &o.CardCode, &o.Note,
		&o.CustomerFirstName, &o.CustomerLastName, &o.CustomerPhone,
		&o.DeliveryType, &o.DeliveryAddress, &o.DeliveryLat, &o.DeliveryLng,
		&o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	rows, _ := database.DB.Query(
		`SELECT id, order_id, COALESCE(menu_item_id, 0), item_name, quantity, unit_price FROM order_items WHERE order_id=$1`, o.ID,
	)
	defer rows.Close()
	for rows.Next() {
		var item models.OrderItem
		rows.Scan(&item.ID, &item.OrderID, &item.MenuItemID, &item.ItemName, &item.Quantity, &item.UnitPrice)
		o.Items = append(o.Items, item)
	}
	c.JSON(http.StatusOK, o)
}

func UpdateOrderStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	validStatuses := map[string]bool{"pending": true, "cooking": true, "ready": true, "served": true}
	if !validStatuses[body.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	_, err := database.DB.Exec(`UPDATE orders SET status=$1 WHERE id=$2`, body.Status, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Auto-deduct ingredient inventory when an order is served
	if body.Status == "served" {
		go DeductInventoryForOrder(id)
	}

	var order models.Order
	database.DB.QueryRow(`SELECT id, order_code, status FROM orders WHERE id=$1`, id).Scan(&order.ID, &order.OrderCode, &order.Status)
	BroadcastMessage("order_status_changed", order)
	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "order": order})
}
