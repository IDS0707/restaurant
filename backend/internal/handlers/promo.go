package handlers

import (
	"net/http"
	"strconv"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// GetPromoDiscount returns all promo discounts (admin) — usually one row.
func GetPromoDiscount(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, code, discount_amount, is_active, updated_at
		 FROM promo_discount ORDER BY id`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []models.PromoDiscount{}
	for rows.Next() {
		var p models.PromoDiscount
		rows.Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.IsActive, &p.UpdatedAt)
		items = append(items, p)
	}
	c.JSON(http.StatusOK, items)
}

// UpdatePromoDiscount lets admin change the discount amount and active flag.
// The code itself is fixed (stays as printed/distributed QR).
func UpdatePromoDiscount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		DiscountAmount float64 `json:"discount_amount"`
		IsActive       *bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}

	_, err := database.DB.Exec(
		`UPDATE promo_discount SET discount_amount=$1, is_active=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
		req.DiscountAmount, active, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var p models.PromoDiscount
	database.DB.QueryRow(
		`SELECT id, code, discount_amount, is_active, updated_at FROM promo_discount WHERE id=$1`, id,
	).Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.IsActive, &p.UpdatedAt)
	c.JSON(http.StatusOK, p)
}
