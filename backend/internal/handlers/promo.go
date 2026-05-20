package handlers

import (
	"net/http"
	"strconv"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetPromoDiscount(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, code, discount_amount, COALESCE(discount_type,'amount'),
		        is_active, COALESCE(usage_limit,0), COALESCE(use_count,0), updated_at
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
		rows.Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.DiscountType, &p.IsActive,
			&p.UsageLimit, &p.UseCount, &p.UpdatedAt)
		items = append(items, p)
	}
	c.JSON(http.StatusOK, items)
}

func UpdatePromoDiscount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		DiscountAmount float64 `json:"discount_amount"`
		DiscountType   string  `json:"discount_type"`
		IsActive       *bool   `json:"is_active"`
		UsageLimit     *int    `json:"usage_limit"`
		ResetCount     bool    `json:"reset_count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	dtype := req.DiscountType
	if dtype != "percent" && dtype != "amount" {
		dtype = "amount"
	}
	// Clamp percent to 0..100
	if dtype == "percent" {
		if req.DiscountAmount < 0 {
			req.DiscountAmount = 0
		}
		if req.DiscountAmount > 100 {
			req.DiscountAmount = 100
		}
	}

	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	limit := 0
	if req.UsageLimit != nil {
		limit = *req.UsageLimit
		if limit < 0 {
			limit = 0
		}
	} else {
		database.DB.QueryRow(`SELECT COALESCE(usage_limit,0) FROM promo_discount WHERE id=$1`, id).Scan(&limit)
	}

	q := `UPDATE promo_discount
	      SET discount_amount=$1, discount_type=$2, is_active=$3, usage_limit=$4, updated_at=CURRENT_TIMESTAMP`
	args := []interface{}{req.DiscountAmount, dtype, active, limit}
	if req.ResetCount {
		q += `, use_count=0`
	}
	q += ` WHERE id=$5`
	args = append(args, id)

	_, err := database.DB.Exec(q, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var p models.PromoDiscount
	database.DB.QueryRow(
		`SELECT id, code, discount_amount, COALESCE(discount_type,'amount'),
		        is_active, COALESCE(usage_limit,0), COALESCE(use_count,0), updated_at
		 FROM promo_discount WHERE id=$1`, id,
	).Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.DiscountType, &p.IsActive,
		&p.UsageLimit, &p.UseCount, &p.UpdatedAt)
	c.JSON(http.StatusOK, p)
}
