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

func makeCustomerToken(customerID int) string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "youit_jwt_secret_key_2024"
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"customer_id": customerID,
		"iat":         time.Now().Unix(),
		// no exp → long-lived (client side can re-issue via /register if needed)
	})
	s, _ := token.SignedString([]byte(secret))
	return s
}

func normalizePhone(p string) string {
	// Keep digits and a leading '+'
	r := strings.ReplaceAll(p, " ", "")
	r = strings.ReplaceAll(r, "-", "")
	r = strings.ReplaceAll(r, "(", "")
	r = strings.ReplaceAll(r, ")", "")
	return r
}

// CustomerRegisterOrLogin
//
// Phone-based onboarding. If the phone already exists, the existing customer
// record is updated with the new name and a fresh token is returned (= login).
// If it doesn't, a new customer is created and a token is returned.
func CustomerRegisterOrLogin(c *gin.Context) {
	var req struct {
		Phone     string `json:"phone" binding:"required"`
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon va ism kiritilishi shart"})
		return
	}
	req.Phone = normalizePhone(req.Phone)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	if req.Phone == "" || req.FirstName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon va ism kiritilishi shart"})
		return
	}

	var cust models.Customer
	err := database.DB.QueryRow(
		`INSERT INTO customers (phone, first_name, last_name)
		 VALUES ($1,$2,$3)
		 ON CONFLICT (phone) DO UPDATE
		    SET first_name = EXCLUDED.first_name,
		        last_name  = EXCLUDED.last_name
		 RETURNING id, phone, first_name, COALESCE(last_name,''), created_at`,
		req.Phone, req.FirstName, req.LastName,
	).Scan(&cust.ID, &cust.Phone, &cust.FirstName, &cust.LastName, &cust.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    makeCustomerToken(cust.ID),
		"customer": cust,
	})
}

// CustomerLogin: phone-only re-issue token if customer exists.
func CustomerLogin(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon kiritilishi shart"})
		return
	}
	req.Phone = normalizePhone(req.Phone)
	var cust models.Customer
	err := database.DB.QueryRow(
		`SELECT id, phone, first_name, COALESCE(last_name,''), created_at FROM customers WHERE phone=$1`,
		req.Phone,
	).Scan(&cust.ID, &cust.Phone, &cust.FirstName, &cust.LastName, &cust.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bunday foydalanuvchi topilmadi"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token":    makeCustomerToken(cust.ID),
		"customer": cust,
	})
}

// GET /api/customer/me
func CustomerMe(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)
	var cust models.Customer
	err := database.DB.QueryRow(
		`SELECT id, phone, first_name, COALESCE(last_name,''), created_at FROM customers WHERE id=$1`,
		customerID,
	).Scan(&cust.ID, &cust.Phone, &cust.FirstName, &cust.LastName, &cust.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Foydalanuvchi topilmadi"})
		return
	}
	c.JSON(http.StatusOK, cust)
}

// PUT /api/customer/me
func CustomerUpdateMe(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)
	var req struct {
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	if req.FirstName != nil {
		database.DB.Exec(`UPDATE customers SET first_name=$1 WHERE id=$2`, strings.TrimSpace(*req.FirstName), customerID)
	}
	if req.LastName != nil {
		database.DB.Exec(`UPDATE customers SET last_name=$1 WHERE id=$2`, strings.TrimSpace(*req.LastName), customerID)
	}
	CustomerMe(c)
}

// GET /api/customer/orders — sign-in customer's order history (newest first)
func CustomerOrders(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)

	rows, err := database.DB.Query(
		`SELECT id, order_code, total_price, discount_amount, final_price, status,
		        COALESCE(card_code,''), COALESCE(note,''),
		        COALESCE(customer_first_name,''), COALESCE(customer_last_name,''),
		        COALESCE(customer_phone,''), COALESCE(delivery_type,'pickup'),
		        COALESCE(delivery_address,''), delivery_lat, delivery_lng,
		        created_at, updated_at
		 FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`,
		customerID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	orders := []models.Order{}
	orderIDs := []int{}
	idIdx := map[int]int{}
	for rows.Next() {
		var o models.Order
		rows.Scan(&o.ID, &o.OrderCode, &o.TotalPrice, &o.DiscountAmount, &o.FinalPrice,
			&o.Status, &o.CardCode, &o.Note,
			&o.CustomerFirstName, &o.CustomerLastName, &o.CustomerPhone,
			&o.DeliveryType, &o.DeliveryAddress, &o.DeliveryLat, &o.DeliveryLng,
			&o.CreatedAt, &o.UpdatedAt)
		o.Items = []models.OrderItem{}
		idIdx[o.ID] = len(orders)
		orderIDs = append(orderIDs, o.ID)
		orders = append(orders, o)
	}

	// fetch items for these orders
	if len(orderIDs) > 0 {
		// build IN clause
		params := make([]string, len(orderIDs))
		args := make([]interface{}, len(orderIDs))
		for i, id := range orderIDs {
			params[i] = "$" + strconv.Itoa(i+1)
			args[i] = id
		}
		q := `SELECT order_id, id, COALESCE(menu_item_id,0), item_name, quantity, unit_price
		      FROM order_items WHERE order_id IN (` + strings.Join(params, ",") + `)`
		irows, ierr := database.DB.Query(q, args...)
		if ierr == nil {
			defer irows.Close()
			for irows.Next() {
				var orderID int
				var item models.OrderItem
				irows.Scan(&orderID, &item.ID, &item.MenuItemID, &item.ItemName, &item.Quantity, &item.UnitPrice)
				item.OrderID = orderID
				if idx, ok := idIdx[orderID]; ok {
					orders[idx].Items = append(orders[idx].Items, item)
				}
			}
		}
	}

	c.JSON(http.StatusOK, orders)
}

// GET /api/customer/addresses
func CustomerAddresses(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)
	rows, err := database.DB.Query(
		`SELECT id, customer_id, COALESCE(label,'Manzil'), address, lat, lng,
		        COALESCE(is_default,false), created_at
		 FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC, created_at DESC`,
		customerID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	list := []models.CustomerAddress{}
	for rows.Next() {
		var a models.CustomerAddress
		rows.Scan(&a.ID, &a.CustomerID, &a.Label, &a.Address, &a.Lat, &a.Lng, &a.IsDefault, &a.CreatedAt)
		list = append(list, a)
	}
	c.JSON(http.StatusOK, list)
}

// POST /api/customer/addresses
func CustomerAddAddress(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)
	var req struct {
		Label     string   `json:"label"`
		Address   string   `json:"address" binding:"required"`
		Lat       *float64 `json:"lat"`
		Lng       *float64 `json:"lng"`
		IsDefault bool     `json:"is_default"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Manzil bo'sh"})
		return
	}
	if strings.TrimSpace(req.Address) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Manzil bo'sh"})
		return
	}
	label := req.Label
	if label == "" {
		label = "Manzil"
	}
	if req.IsDefault {
		database.DB.Exec(`UPDATE customer_addresses SET is_default=false WHERE customer_id=$1`, customerID)
	}
	var a models.CustomerAddress
	err := database.DB.QueryRow(
		`INSERT INTO customer_addresses (customer_id, label, address, lat, lng, is_default)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, customer_id, label, address, lat, lng, COALESCE(is_default,false), created_at`,
		customerID, label, strings.TrimSpace(req.Address), req.Lat, req.Lng, req.IsDefault,
	).Scan(&a.ID, &a.CustomerID, &a.Label, &a.Address, &a.Lat, &a.Lng, &a.IsDefault, &a.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

// DELETE /api/customer/addresses/:id
func CustomerDeleteAddress(c *gin.Context) {
	cid, _ := c.Get("customer_id")
	customerID, _ := cid.(int)
	id, _ := strconv.Atoi(c.Param("id"))
	_, err := database.DB.Exec(`DELETE FROM customer_addresses WHERE id=$1 AND customer_id=$2`, id, customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
