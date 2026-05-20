package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetVipCards(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, code, first_name, COALESCE(last_name,''),
		        is_active, COALESCE(use_count,0), created_at
		 FROM vip_cards ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []models.VipCard{}
	for rows.Next() {
		var v models.VipCard
		rows.Scan(&v.ID, &v.Code, &v.FirstName, &v.LastName,
			&v.IsActive, &v.UseCount, &v.CreatedAt)
		items = append(items, v)
	}
	c.JSON(http.StatusOK, items)
}

func CreateVipCard(c *gin.Context) {
	var req struct {
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ism kiritilishi shart"})
		return
	}
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	if req.FirstName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ism bo'sh"})
		return
	}

	code := "VIP-" + generateUniqueCode(8, "vip_cards", "code")

	var v models.VipCard
	err := database.DB.QueryRow(
		`INSERT INTO vip_cards (code, first_name, last_name)
		 VALUES ($1,$2,$3)
		 RETURNING id, code, first_name, COALESCE(last_name,''),
		           is_active, COALESCE(use_count,0), created_at`,
		code, req.FirstName, req.LastName,
	).Scan(&v.ID, &v.Code, &v.FirstName, &v.LastName,
		&v.IsActive, &v.UseCount, &v.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, v)
}

func UpdateVipCard(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
		IsActive  *bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	// Fetch current values then overlay
	var v models.VipCard
	err := database.DB.QueryRow(
		`SELECT id, code, first_name, COALESCE(last_name,''),
		        is_active, COALESCE(use_count,0), created_at
		 FROM vip_cards WHERE id=$1`, id,
	).Scan(&v.ID, &v.Code, &v.FirstName, &v.LastName,
		&v.IsActive, &v.UseCount, &v.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "VIP topilmadi"})
		return
	}

	if req.FirstName != nil {
		v.FirstName = strings.TrimSpace(*req.FirstName)
	}
	if req.LastName != nil {
		v.LastName = strings.TrimSpace(*req.LastName)
	}
	if req.IsActive != nil {
		v.IsActive = *req.IsActive
	}

	_, err = database.DB.Exec(
		`UPDATE vip_cards SET first_name=$1, last_name=$2, is_active=$3 WHERE id=$4`,
		v.FirstName, v.LastName, v.IsActive, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, v)
}

func DeleteVipCard(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_, err := database.DB.Exec(`DELETE FROM vip_cards WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
