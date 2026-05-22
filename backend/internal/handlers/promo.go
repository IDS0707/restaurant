package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func parseValidUntil(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	// Try common formats: RFC3339, ISO date, datetime-local
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02T15:04", "2006-01-02"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return &t
		}
	}
	return nil
}

func GetPromoDiscount(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, code, discount_amount, COALESCE(discount_type,'amount'),
		        is_active, COALESCE(usage_limit,0), COALESCE(use_count,0),
		        valid_until, COALESCE(created_at, CURRENT_TIMESTAMP), updated_at
		 FROM promo_discount ORDER BY created_at DESC NULLS LAST, id DESC`,
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
			&p.UsageLimit, &p.UseCount, &p.ValidUntil, &p.CreatedAt, &p.UpdatedAt)
		items = append(items, p)
	}
	c.JSON(http.StatusOK, items)
}

func CreatePromoDiscount(c *gin.Context) {
	var req struct {
		Code           string  `json:"code" binding:"required"`
		DiscountAmount float64 `json:"discount_amount"`
		DiscountType   string  `json:"discount_type"`
		IsActive       *bool   `json:"is_active"`
		UsageLimit     int     `json:"usage_limit"`
		ValidUntil     string  `json:"valid_until"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kod kiritilishi shart"})
		return
	}
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	if req.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kod bo'sh"})
		return
	}
	dtype := req.DiscountType
	if dtype != "percent" && dtype != "amount" {
		dtype = "amount"
	}
	if dtype == "percent" && req.DiscountAmount > 100 {
		req.DiscountAmount = 100
	}
	if req.DiscountAmount < 0 {
		req.DiscountAmount = 0
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	limit := req.UsageLimit
	if limit < 0 {
		limit = 0
	}
	validUntil := parseValidUntil(req.ValidUntil)

	var p models.PromoDiscount
	err := database.DB.QueryRow(
		`INSERT INTO promo_discount (code, discount_amount, discount_type, is_active, usage_limit, use_count, valid_until)
		 VALUES ($1,$2,$3,$4,$5,0,$6)
		 RETURNING id, code, discount_amount, COALESCE(discount_type,'amount'),
		           is_active, COALESCE(usage_limit,0), COALESCE(use_count,0),
		           valid_until, COALESCE(created_at, CURRENT_TIMESTAMP), updated_at`,
		req.Code, req.DiscountAmount, dtype, active, limit, validUntil,
	).Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.DiscountType, &p.IsActive,
		&p.UsageLimit, &p.UseCount, &p.ValidUntil, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bu kod allaqachon mavjud"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func UpdatePromoDiscount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		DiscountAmount float64 `json:"discount_amount"`
		DiscountType   string  `json:"discount_type"`
		IsActive       *bool   `json:"is_active"`
		UsageLimit     *int    `json:"usage_limit"`
		ValidUntil     *string `json:"valid_until"`
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
	if dtype == "percent" {
		if req.DiscountAmount > 100 {
			req.DiscountAmount = 100
		}
		if req.DiscountAmount < 0 {
			req.DiscountAmount = 0
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
	var validUntilArg interface{}
	if req.ValidUntil != nil {
		validUntilArg = parseValidUntil(*req.ValidUntil)
	} else {
		// preserve existing value
		var existing *time.Time
		database.DB.QueryRow(`SELECT valid_until FROM promo_discount WHERE id=$1`, id).Scan(&existing)
		validUntilArg = existing
	}

	q := `UPDATE promo_discount
	      SET discount_amount=$1, discount_type=$2, is_active=$3, usage_limit=$4, valid_until=$5, updated_at=CURRENT_TIMESTAMP`
	args := []interface{}{req.DiscountAmount, dtype, active, limit, validUntilArg}
	if req.ResetCount {
		q += `, use_count=0`
	}
	q += ` WHERE id=$6`
	args = append(args, id)

	_, err := database.DB.Exec(q, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var p models.PromoDiscount
	database.DB.QueryRow(
		`SELECT id, code, discount_amount, COALESCE(discount_type,'amount'),
		        is_active, COALESCE(usage_limit,0), COALESCE(use_count,0),
		        valid_until, COALESCE(created_at, CURRENT_TIMESTAMP), updated_at
		 FROM promo_discount WHERE id=$1`, id,
	).Scan(&p.ID, &p.Code, &p.DiscountAmount, &p.DiscountType, &p.IsActive,
		&p.UsageLimit, &p.UseCount, &p.ValidUntil, &p.CreatedAt, &p.UpdatedAt)
	c.JSON(http.StatusOK, p)
}

func DeletePromoDiscount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_, err := database.DB.Exec(`DELETE FROM promo_discount WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
