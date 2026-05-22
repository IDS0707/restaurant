package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ───────── helpers ─────────

func makeCourierToken(courierID int) string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "youit_jwt_secret_key_2024"
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"courier_id": courierID,
		"role":       "courier",
		"exp":        time.Now().Add(30 * 24 * time.Hour).Unix(),
	})
	signed, _ := tok.SignedString([]byte(secret))
	return signed
}

// ───────── public ─────────

// POST /api/courier/login — { phone, pin }
func CourierLogin(c *gin.Context) {
	var body struct {
		Phone string `json:"phone" binding:"required"`
		PIN   string `json:"pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon va PIN kerak"})
		return
	}
	phone := normalizePhone(body.Phone)

	var co models.Courier
	var dbPin string
	err := database.DB.QueryRow(
		`SELECT id, phone, first_name, COALESCE(last_name,''), pin, is_active,
		        current_lat, current_lng, last_seen_at, created_at
		 FROM couriers WHERE phone=$1`, phone,
	).Scan(&co.ID, &co.Phone, &co.FirstName, &co.LastName, &dbPin, &co.IsActive,
		&co.CurrentLat, &co.CurrentLng, &co.LastSeenAt, &co.CreatedAt)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kuryer topilmadi"})
		return
	}
	if !co.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hisob faolsiz"})
		return
	}
	if dbPin != strings.TrimSpace(body.PIN) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Noto'g'ri PIN"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": makeCourierToken(co.ID), "courier": co})
}

// GET /api/courier/me
func CourierMe(c *gin.Context) {
	cid, _ := c.Get("courier_id")
	id, _ := cid.(int)
	var co models.Courier
	err := database.DB.QueryRow(
		`SELECT id, phone, first_name, COALESCE(last_name,''), is_active,
		        current_lat, current_lng, last_seen_at, created_at
		 FROM couriers WHERE id=$1`, id,
	).Scan(&co.ID, &co.Phone, &co.FirstName, &co.LastName, &co.IsActive,
		&co.CurrentLat, &co.CurrentLng, &co.LastSeenAt, &co.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Topilmadi"})
		return
	}
	c.JSON(http.StatusOK, co)
}

// GET /api/courier/orders/available — ready orders not yet assigned
func CourierAvailableOrders(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, order_code, total_price, discount_amount, final_price, status,
		        COALESCE(card_code,''), COALESCE(note,''),
		        COALESCE(customer_first_name,''), COALESCE(customer_last_name,''),
		        COALESCE(customer_phone,''), COALESCE(delivery_type,'pickup'),
		        COALESCE(delivery_address,''), delivery_lat, delivery_lng,
		        created_at, updated_at
		 FROM orders
		 WHERE status='ready' AND courier_id IS NULL AND delivery_type='delivery'
		 ORDER BY created_at ASC LIMIT 50`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	orders := scanCourierOrderRows(rows)
	attachOrderItems(orders)
	c.JSON(http.StatusOK, orders)
}

// GET /api/courier/orders/mine — orders currently assigned to this courier
func CourierMyOrders(c *gin.Context) {
	cid, _ := c.Get("courier_id")
	id, _ := cid.(int)
	rows, err := database.DB.Query(
		`SELECT id, order_code, total_price, discount_amount, final_price, status,
		        COALESCE(card_code,''), COALESCE(note,''),
		        COALESCE(customer_first_name,''), COALESCE(customer_last_name,''),
		        COALESCE(customer_phone,''), COALESCE(delivery_type,'pickup'),
		        COALESCE(delivery_address,''), delivery_lat, delivery_lng,
		        created_at, updated_at
		 FROM orders
		 WHERE courier_id=$1 AND status IN ('on_way','served')
		 ORDER BY (status='on_way') DESC, created_at DESC LIMIT 50`,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	orders := scanCourierOrderRows(rows)
	attachOrderItems(orders)
	c.JSON(http.StatusOK, orders)
}

func scanCourierOrderRows(rows *sql.Rows) []models.Order {
	res := []models.Order{}
	for rows.Next() {
		var o models.Order
		rows.Scan(&o.ID, &o.OrderCode, &o.TotalPrice, &o.DiscountAmount, &o.FinalPrice,
			&o.Status, &o.CardCode, &o.Note,
			&o.CustomerFirstName, &o.CustomerLastName, &o.CustomerPhone,
			&o.DeliveryType, &o.DeliveryAddress, &o.DeliveryLat, &o.DeliveryLng,
			&o.CreatedAt, &o.UpdatedAt)
		o.Items = []models.OrderItem{}
		res = append(res, o)
	}
	return res
}

func attachOrderItems(orders []models.Order) {
	if len(orders) == 0 {
		return
	}
	idx := map[int]int{}
	params := make([]string, len(orders))
	args := make([]interface{}, len(orders))
	for i, o := range orders {
		idx[o.ID] = i
		params[i] = "$" + strconv.Itoa(i+1)
		args[i] = o.ID
	}
	q := `SELECT order_id, id, COALESCE(menu_item_id,0), item_name, quantity, unit_price
	      FROM order_items WHERE order_id IN (` + strings.Join(params, ",") + `)`
	rows, err := database.DB.Query(q, args...)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var orderID int
		var item models.OrderItem
		rows.Scan(&orderID, &item.ID, &item.MenuItemID, &item.ItemName, &item.Quantity, &item.UnitPrice)
		item.OrderID = orderID
		if i, ok := idx[orderID]; ok {
			orders[i].Items = append(orders[i].Items, item)
		}
	}
}

// POST /api/courier/orders/:id/accept — courier takes the order, status → on_way
func CourierAcceptOrder(c *gin.Context) {
	cid, _ := c.Get("courier_id")
	courierID, _ := cid.(int)
	orderID, _ := strconv.Atoi(c.Param("id"))

	// Race-safe: only ready+unassigned can be claimed
	res, err := database.DB.Exec(
		`UPDATE orders SET courier_id=$1, status='on_way', updated_at=CURRENT_TIMESTAMP
		 WHERE id=$2 AND status='ready' AND courier_id IS NULL`,
		courierID, orderID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Bu buyurtmani allaqachon boshqa kuryer oldi"})
		return
	}

	var o models.Order
	database.DB.QueryRow(`SELECT id, order_code, status FROM orders WHERE id=$1`, orderID).
		Scan(&o.ID, &o.OrderCode, &o.Status)
	BroadcastMessage("order_status_changed", o)
	c.JSON(http.StatusOK, gin.H{"message": "Olindi", "order_id": orderID})
}

// POST /api/courier/orders/:id/complete — courier delivered, status → served
func CourierCompleteOrder(c *gin.Context) {
	cid, _ := c.Get("courier_id")
	courierID, _ := cid.(int)
	orderID, _ := strconv.Atoi(c.Param("id"))

	res, err := database.DB.Exec(
		`UPDATE orders SET status='served', updated_at=CURRENT_TIMESTAMP
		 WHERE id=$1 AND courier_id=$2 AND status='on_way'`,
		orderID, courierID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Buyurtma topilmadi yoki holati noto'g'ri"})
		return
	}

	// Trigger inventory deduction (same as cashier)
	go DeductInventoryForOrder(orderID)

	var o models.Order
	database.DB.QueryRow(`SELECT id, order_code, status FROM orders WHERE id=$1`, orderID).
		Scan(&o.ID, &o.OrderCode, &o.Status)
	BroadcastMessage("order_status_changed", o)
	c.JSON(http.StatusOK, gin.H{"message": "Yetkazildi"})
}

// POST /api/courier/location — { lat, lng } update + broadcast for active order
func CourierUpdateLocation(c *gin.Context) {
	cid, _ := c.Get("courier_id")
	courierID, _ := cid.(int)
	var body struct {
		Lat float64 `json:"lat" binding:"required"`
		Lng float64 `json:"lng" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid"})
		return
	}
	_, err := database.DB.Exec(
		`UPDATE couriers SET current_lat=$1, current_lng=$2,
		                     last_seen_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
		 WHERE id=$3`,
		body.Lat, body.Lng, courierID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast for any active on_way orders this courier is delivering so the
	// customer app can move the marker live.
	rows, _ := database.DB.Query(
		`SELECT id, order_code FROM orders WHERE courier_id=$1 AND status='on_way'`,
		courierID,
	)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var oid int
			var code string
			rows.Scan(&oid, &code)
			BroadcastMessage("courier_location", gin.H{
				"order_id":   oid,
				"order_code": code,
				"courier_id": courierID,
				"lat":        body.Lat,
				"lng":        body.Lng,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /api/courier/courier-of/:code — public: customer fetches courier info for their order
// (only returns name/phone/lat/lng if courier is assigned and order is on_way).
func PublicCourierForOrder(c *gin.Context) {
	code := c.Param("code")
	var courierID sql.NullInt64
	var orderStatus string
	err := database.DB.QueryRow(
		`SELECT courier_id, status FROM orders WHERE order_code=$1`, code,
	).Scan(&courierID, &orderStatus)
	if err != nil || !courierID.Valid {
		c.JSON(http.StatusNotFound, gin.H{"error": "Yo'q"})
		return
	}
	if orderStatus != "on_way" && orderStatus != "served" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Buyurtma yo'lda emas"})
		return
	}
	var co models.Courier
	err = database.DB.QueryRow(
		`SELECT id, phone, first_name, COALESCE(last_name,''),
		        current_lat, current_lng, last_seen_at
		 FROM couriers WHERE id=$1`, courierID.Int64,
	).Scan(&co.ID, &co.Phone, &co.FirstName, &co.LastName,
		&co.CurrentLat, &co.CurrentLng, &co.LastSeenAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Topilmadi"})
		return
	}
	co.IsActive = true
	c.JSON(http.StatusOK, co)
}

// ───────── Admin CRUD ─────────

func AdminListCouriers(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, phone, first_name, COALESCE(last_name,''), pin, is_active,
		        current_lat, current_lng, last_seen_at, created_at
		 FROM couriers ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []models.Courier{}
	for rows.Next() {
		var co models.Courier
		var pin string
		rows.Scan(&co.ID, &co.Phone, &co.FirstName, &co.LastName, &pin, &co.IsActive,
			&co.CurrentLat, &co.CurrentLng, &co.LastSeenAt, &co.CreatedAt)
		co.PIN = pin
		out = append(out, co)
	}
	c.JSON(http.StatusOK, out)
}

func AdminCreateCourier(c *gin.Context) {
	var body struct {
		Phone     string `json:"phone" binding:"required"`
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name"`
		PIN       string `json:"pin" binding:"required"`
		IsActive  *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon, ism va PIN kerak"})
		return
	}
	phone := normalizePhone(body.Phone)
	active := true
	if body.IsActive != nil {
		active = *body.IsActive
	}
	var co models.Courier
	err := database.DB.QueryRow(
		`INSERT INTO couriers (phone, first_name, last_name, pin, is_active)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, phone, first_name, COALESCE(last_name,''), is_active, created_at`,
		phone, body.FirstName, body.LastName, body.PIN, active,
	).Scan(&co.ID, &co.Phone, &co.FirstName, &co.LastName, &co.IsActive, &co.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bu telefon raqami band"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	co.PIN = body.PIN
	c.JSON(http.StatusCreated, co)
}

func AdminUpdateCourier(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Phone     string `json:"phone"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		PIN       string `json:"pin"`
		IsActive  *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid"})
		return
	}
	q := `UPDATE couriers SET first_name=$1, last_name=$2, updated_at=CURRENT_TIMESTAMP`
	args := []interface{}{body.FirstName, body.LastName}
	pos := 2
	if body.Phone != "" {
		pos++
		q += ", phone=$" + strconv.Itoa(pos)
		args = append(args, normalizePhone(body.Phone))
	}
	if body.PIN != "" {
		pos++
		q += ", pin=$" + strconv.Itoa(pos)
		args = append(args, body.PIN)
	}
	if body.IsActive != nil {
		pos++
		q += ", is_active=$" + strconv.Itoa(pos)
		args = append(args, *body.IsActive)
	}
	pos++
	q += " WHERE id=$" + strconv.Itoa(pos)
	args = append(args, id)
	if _, err := database.DB.Exec(q, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func AdminDeleteCourier(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_, err := database.DB.Exec(`DELETE FROM couriers WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
