package handlers

import (
	"net/http"
	"strconv"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetMenu(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, name, description, price, category, COALESCE(image_url,''), available,
		        COALESCE(markup_percent,0), COALESCE(food_cost,0), created_at
		 FROM menu_items ORDER BY category, name`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []models.MenuItem{}
	for rows.Next() {
		var m models.MenuItem
		rows.Scan(&m.ID, &m.Name, &m.Description, &m.Price, &m.Category, &m.ImageURL, &m.Available,
			&m.MarkupPercent, &m.FoodCost, &m.CreatedAt)
		items = append(items, m)
	}
	c.JSON(http.StatusOK, items)
}

func CreateMenuItem(c *gin.Context) {
	var m models.MenuItem
	if err := c.ShouldBindJSON(&m); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	err := database.DB.QueryRow(
		`INSERT INTO menu_items (name, description, price, category, image_url, available)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
		m.Name, m.Description, m.Price, m.Category, m.ImageURL, true,
	).Scan(&m.ID, &m.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	m.Available = true
	BroadcastMessage("menu_updated", m)
	c.JSON(http.StatusCreated, m)
}

func UpdateMenuItem(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var m models.MenuItem
	if err := c.ShouldBindJSON(&m); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	_, err := database.DB.Exec(
		`UPDATE menu_items SET name=$1, description=$2, price=$3, category=$4, image_url=$5, available=$6 WHERE id=$7`,
		m.Name, m.Description, m.Price, m.Category, m.ImageURL, m.Available, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	m.ID = id
	BroadcastMessage("menu_updated", m)
	c.JSON(http.StatusOK, m)
}

func DeleteMenuItem(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	// Nullify FK in order_items so existing order history is preserved
	database.DB.Exec(`UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = $1`, id)
	_, err := database.DB.Exec(`DELETE FROM menu_items WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	BroadcastMessage("menu_updated", gin.H{"deleted_id": id})
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func ToggleMenuItemAvailability(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var row struct {
		Available bool `json:"available"`
	}
	if err := c.ShouldBindJSON(&row); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	_, err := database.DB.Exec(`UPDATE menu_items SET available=$1 WHERE id=$2`, row.Available, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	BroadcastMessage("menu_updated", gin.H{"id": id, "available": row.Available})
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}
