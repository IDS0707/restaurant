package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// unitCostFactor converts quantity_used (in recipeUnit) into ingredientUnit.
// Example: 300g beef, ingredient stored as kg → 300 * 1/1000 = 0.3 kg
func unitCostFactor(quantity float64, recipeUnit, ingredientUnit string) float64 {
	if recipeUnit == ingredientUnit {
		return quantity
	}
	weightToG := map[string]float64{"kg": 1000, "g": 1, "10g": 10}
	volToML := map[string]float64{"liter": 1000, "ml": 1}

	if fg, ok1 := weightToG[recipeUnit]; ok1 {
		if tg, ok2 := weightToG[ingredientUnit]; ok2 {
			return quantity * fg / tg
		}
	}
	if fv, ok1 := volToML[recipeUnit]; ok1 {
		if tv, ok2 := volToML[ingredientUnit]; ok2 {
			return quantity * fv / tv
		}
	}
	return quantity
}

// recalculateFoodCost sums all recipe ingredient costs and updates menu_items.
// If markup_percent > 0 it also updates the sale price.
func recalculateFoodCost(menuItemID int) {
	rows, err := database.DB.Query(`
		SELECT ri.quantity_used, ri.unit, i.measurement_unit, i.unit_price
		FROM recipe_items ri
		JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE ri.menu_item_id = $1
	`, menuItemID)
	if err != nil {
		return
	}
	defer rows.Close()

	var totalCost float64
	for rows.Next() {
		var qty float64
		var recipeUnit, ingUnit string
		var unitPrice float64
		rows.Scan(&qty, &recipeUnit, &ingUnit, &unitPrice)
		converted := unitCostFactor(qty, recipeUnit, ingUnit)
		totalCost += converted * unitPrice
	}

	var markup float64
	database.DB.QueryRow(
		`SELECT COALESCE(markup_percent, 0) FROM menu_items WHERE id=$1`, menuItemID,
	).Scan(&markup)

	if markup > 0 {
		salePrice := totalCost * (1 + markup/100)
		database.DB.Exec(
			`UPDATE menu_items SET food_cost=$1, price=$2 WHERE id=$3`,
			totalCost, salePrice, menuItemID,
		)
	} else {
		database.DB.Exec(
			`UPDATE menu_items SET food_cost=$1 WHERE id=$2`,
			totalCost, menuItemID,
		)
	}
}

// DeductInventoryForOrder is called when an order is marked "served".
// It deducts recipe ingredient quantities from stock and logs each movement.
func DeductInventoryForOrder(orderID int) {
	// Idempotency: skip if already deducted
	var count int
	database.DB.QueryRow(
		`SELECT COUNT(*) FROM inventory_logs WHERE order_id=$1 AND action='sale_deduction'`, orderID,
	).Scan(&count)
	if count > 0 {
		return
	}

	type oItem struct {
		menuItemID int
		quantity   int
		itemName   string
	}

	rows, err := database.DB.Query(`
		SELECT COALESCE(menu_item_id, 0), quantity, item_name
		FROM order_items WHERE order_id=$1 AND menu_item_id IS NOT NULL
	`, orderID)
	if err != nil {
		return
	}
	var items []oItem
	for rows.Next() {
		var it oItem
		rows.Scan(&it.menuItemID, &it.quantity, &it.itemName)
		if it.menuItemID > 0 {
			items = append(items, it)
		}
	}
	rows.Close()

	for _, oi := range items {
		rrows, err := database.DB.Query(`
			SELECT ri.ingredient_id, ri.quantity_used, ri.unit,
			       i.measurement_unit, i.name
			FROM recipe_items ri
			JOIN ingredients i ON ri.ingredient_id = i.id
			WHERE ri.menu_item_id = $1
		`, oi.menuItemID)
		if err != nil {
			continue
		}
		for rrows.Next() {
			var ingID int
			var qtyUsed float64
			var recipeUnit, ingUnit, ingName string
			rrows.Scan(&ingID, &qtyUsed, &recipeUnit, &ingUnit, &ingName)

			totalDeduct := unitCostFactor(qtyUsed*float64(oi.quantity), recipeUnit, ingUnit)

			database.DB.Exec(
				`UPDATE ingredients SET quantity = GREATEST(0, quantity - $1) WHERE id=$2`,
				totalDeduct, ingID,
			)
			database.DB.Exec(`
				INSERT INTO inventory_logs
				  (ingredient_id, ingredient_name, order_id, menu_item_id, quantity_change, action, notes)
				VALUES ($1,$2,$3,$4,$5,'sale_deduction',$6)
			`, ingID, ingName, orderID, oi.menuItemID, -totalDeduct,
				fmt.Sprintf("%dx %s", oi.quantity, oi.itemName))
		}
		rrows.Close()
	}
}

// ─── Ingredient CRUD ──────────────────────────────────────────────────────────

func GetIngredients(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, name, category, measurement_unit, quantity, unit_price,
		       quantity * unit_price AS total_cost,
		       COALESCE(low_stock_threshold, 5), created_at
		FROM ingredients ORDER BY category, name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []models.Ingredient{}
	for rows.Next() {
		var ing models.Ingredient
		rows.Scan(&ing.ID, &ing.Name, &ing.Category, &ing.MeasurementUnit,
			&ing.Quantity, &ing.UnitPrice, &ing.TotalCost,
			&ing.LowStockThreshold, &ing.CreatedAt)
		ing.IsLowStock = ing.Quantity <= ing.LowStockThreshold
		items = append(items, ing)
	}
	c.JSON(http.StatusOK, items)
}

func CreateIngredient(c *gin.Context) {
	var req struct {
		Name              string  `json:"name"             binding:"required"`
		Category          string  `json:"category"`
		MeasurementUnit   string  `json:"measurement_unit" binding:"required"`
		Quantity          float64 `json:"quantity"`
		UnitPrice         float64 `json:"unit_price"`
		LowStockThreshold float64 `json:"low_stock_threshold"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	if req.Category == "" {
		req.Category = "Умумий"
	}
	if req.LowStockThreshold == 0 {
		req.LowStockThreshold = 5
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}
	defer tx.Rollback()

	var ing models.Ingredient
	err = tx.QueryRow(`
		INSERT INTO ingredients (name, category, measurement_unit, quantity, unit_price, low_stock_threshold)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, name, category, measurement_unit, quantity, unit_price,
		          quantity * unit_price, low_stock_threshold, created_at
	`, req.Name, req.Category, req.MeasurementUnit, req.Quantity, req.UnitPrice, req.LowStockThreshold,
	).Scan(&ing.ID, &ing.Name, &ing.Category, &ing.MeasurementUnit,
		&ing.Quantity, &ing.UnitPrice, &ing.TotalCost,
		&ing.LowStockThreshold, &ing.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ing.IsLowStock = ing.Quantity <= ing.LowStockThreshold

	totalCost := req.Quantity * req.UnitPrice

	// Purchase history
	tx.Exec(`
		INSERT INTO ingredient_purchases (ingredient_id, quantity_purchased, unit_price, total_cost, notes)
		VALUES ($1,$2,$3,$4,$5)
	`, ing.ID, req.Quantity, req.UnitPrice, totalCost,
		fmt.Sprintf("Дастлабки захира: %s", req.Name))

	// Auto-expense so analytics picks it up
	if totalCost > 0 {
		tx.Exec(`
			INSERT INTO expenses (description, amount, category, expense_type, is_recurring)
			VALUES ($1,$2,'Омбор','one_time',false)
		`, fmt.Sprintf("%s харид: %.2f %s", req.Name, req.Quantity, req.MeasurementUnit), totalCost)

		// Inventory log
		tx.Exec(`
			INSERT INTO inventory_logs (ingredient_id, ingredient_name, quantity_change, action, notes)
			VALUES ($1,$2,$3,'purchase',$4)
		`, ing.ID, ing.Name, req.Quantity,
			fmt.Sprintf("Дастлабки захира: %.2f %s", req.Quantity, req.MeasurementUnit))
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
		return
	}
	c.JSON(http.StatusCreated, ing)
}

func RestockIngredient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		AddQuantity float64 `json:"add_quantity" binding:"required"`
		UnitPrice   float64 `json:"unit_price"   binding:"required"`
		Notes       string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}
	defer tx.Rollback()

	var ingName, ingUnit string
	tx.QueryRow(`SELECT name, measurement_unit FROM ingredients WHERE id=$1`, id).Scan(&ingName, &ingUnit)

	tx.Exec(`UPDATE ingredients SET quantity=quantity+$1, unit_price=$2 WHERE id=$3`,
		req.AddQuantity, req.UnitPrice, id)

	totalCost := req.AddQuantity * req.UnitPrice
	notes := req.Notes
	if notes == "" {
		notes = fmt.Sprintf("Қайта тўлдириш: %.2f %s", req.AddQuantity, ingUnit)
	}

	tx.Exec(`
		INSERT INTO ingredient_purchases (ingredient_id, quantity_purchased, unit_price, total_cost, notes)
		VALUES ($1,$2,$3,$4,$5)
	`, id, req.AddQuantity, req.UnitPrice, totalCost, notes)

	if totalCost > 0 {
		tx.Exec(`
			INSERT INTO expenses (description, amount, category, expense_type, is_recurring)
			VALUES ($1,$2,'Омбор','one_time',false)
		`, fmt.Sprintf("%s қайта харид: %.2f %s", ingName, req.AddQuantity, ingUnit), totalCost)

		tx.Exec(`
			INSERT INTO inventory_logs (ingredient_id, ingredient_name, quantity_change, action, notes)
			VALUES ($1,$2,$3,'purchase',$4)
		`, id, ingName, req.AddQuantity, notes)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
		return
	}

	var ing models.Ingredient
	database.DB.QueryRow(`
		SELECT id, name, category, measurement_unit, quantity, unit_price,
		       quantity * unit_price, COALESCE(low_stock_threshold, 5), created_at
		FROM ingredients WHERE id=$1
	`, id).Scan(&ing.ID, &ing.Name, &ing.Category, &ing.MeasurementUnit,
		&ing.Quantity, &ing.UnitPrice, &ing.TotalCost,
		&ing.LowStockThreshold, &ing.CreatedAt)
	ing.IsLowStock = ing.Quantity <= ing.LowStockThreshold

	c.JSON(http.StatusOK, ing)
}

func UpdateIngredient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Name              string  `json:"name"`
		Category          string  `json:"category"`
		MeasurementUnit   string  `json:"measurement_unit"`
		Quantity          float64 `json:"quantity"`
		UnitPrice         float64 `json:"unit_price"`
		LowStockThreshold float64 `json:"low_stock_threshold"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	if req.LowStockThreshold == 0 {
		req.LowStockThreshold = 5
	}

	_, err := database.DB.Exec(`
		UPDATE ingredients
		SET name=$1, category=$2, measurement_unit=$3,
		    quantity=$4, unit_price=$5, low_stock_threshold=$6
		WHERE id=$7
	`, req.Name, req.Category, req.MeasurementUnit,
		req.Quantity, req.UnitPrice, req.LowStockThreshold, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var ing models.Ingredient
	database.DB.QueryRow(`
		SELECT id, name, category, measurement_unit, quantity, unit_price,
		       quantity * unit_price, COALESCE(low_stock_threshold, 5), created_at
		FROM ingredients WHERE id=$1
	`, id).Scan(&ing.ID, &ing.Name, &ing.Category, &ing.MeasurementUnit,
		&ing.Quantity, &ing.UnitPrice, &ing.TotalCost,
		&ing.LowStockThreshold, &ing.CreatedAt)
	ing.IsLowStock = ing.Quantity <= ing.LowStockThreshold

	c.JSON(http.StatusOK, ing)
}

func DeleteIngredient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_, err := database.DB.Exec(`DELETE FROM ingredients WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── Menu Item Detail + Recipe ────────────────────────────────────────────────

func GetMenuItemDetail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var item models.MenuItemDetail
	err := database.DB.QueryRow(`
		SELECT id, name, description, price, category,
		       COALESCE(image_url,''), available,
		       COALESCE(markup_percent,0), COALESCE(food_cost,0), created_at
		FROM menu_items WHERE id=$1
	`, id).Scan(&item.ID, &item.Name, &item.Description, &item.Price,
		&item.Category, &item.ImageURL, &item.Available,
		&item.MarkupPercent, &item.FoodCost, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu item not found"})
		return
	}

	rows, _ := database.DB.Query(`
		SELECT ri.id, ri.menu_item_id, ri.ingredient_id, i.name,
		       ri.quantity_used, ri.unit, i.measurement_unit, i.unit_price
		FROM recipe_items ri
		JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE ri.menu_item_id = $1
		ORDER BY i.name
	`, id)
	if rows != nil {
		defer rows.Close()
		var totalFoodCost float64
		for rows.Next() {
			var ri models.RecipeItemDetail
			rows.Scan(&ri.ID, &ri.MenuItemID, &ri.IngredientID, &ri.IngredientName,
				&ri.QuantityUsed, &ri.Unit, &ri.IngredientUnit, &ri.UnitPrice)
			converted := unitCostFactor(ri.QuantityUsed, ri.Unit, ri.IngredientUnit)
			ri.Cost = converted * ri.UnitPrice
			totalFoodCost += ri.Cost
			item.Recipe = append(item.Recipe, ri)
		}
		item.FoodCost = totalFoodCost

		if item.MarkupPercent > 0 {
			item.SalePrice = totalFoodCost * (1 + item.MarkupPercent/100)
		} else {
			item.SalePrice = item.Price
		}

		// Cache updated food_cost in DB
		if totalFoodCost > 0 {
			if item.MarkupPercent > 0 {
				database.DB.Exec(`UPDATE menu_items SET food_cost=$1, price=$2 WHERE id=$3`,
					totalFoodCost, item.SalePrice, id)
				item.Price = item.SalePrice
			} else {
				database.DB.Exec(`UPDATE menu_items SET food_cost=$1 WHERE id=$2`, totalFoodCost, id)
			}
		}
	}

	if item.Recipe == nil {
		item.Recipe = []models.RecipeItemDetail{}
	}
	c.JSON(http.StatusOK, item)
}

func AddRecipeItem(c *gin.Context) {
	menuItemID, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		IngredientID int     `json:"ingredient_id" binding:"required"`
		QuantityUsed float64 `json:"quantity_used" binding:"required"`
		Unit         string  `json:"unit"          binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	var ri models.RecipeItemDetail
	err := database.DB.QueryRow(`
		INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity_used, unit)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (menu_item_id, ingredient_id)
		DO UPDATE SET quantity_used=EXCLUDED.quantity_used, unit=EXCLUDED.unit
		RETURNING id, menu_item_id, ingredient_id, quantity_used, unit
	`, menuItemID, req.IngredientID, req.QuantityUsed, req.Unit,
	).Scan(&ri.ID, &ri.MenuItemID, &ri.IngredientID, &ri.QuantityUsed, &ri.Unit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.QueryRow(
		`SELECT name, measurement_unit, unit_price FROM ingredients WHERE id=$1`, req.IngredientID,
	).Scan(&ri.IngredientName, &ri.IngredientUnit, &ri.UnitPrice)

	converted := unitCostFactor(ri.QuantityUsed, ri.Unit, ri.IngredientUnit)
	ri.Cost = converted * ri.UnitPrice

	recalculateFoodCost(menuItemID)
	c.JSON(http.StatusCreated, ri)
}

func DeleteRecipeItem(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	var menuItemID int
	database.DB.QueryRow(`SELECT menu_item_id FROM recipe_items WHERE id=$1`, id).Scan(&menuItemID)

	_, err := database.DB.Exec(`DELETE FROM recipe_items WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recalculateFoodCost(menuItemID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func UpdateMenuMarkup(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		MarkupPercent float64 `json:"markup_percent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	database.DB.Exec(`UPDATE menu_items SET markup_percent=$1 WHERE id=$2`, req.MarkupPercent, id)
	recalculateFoodCost(id)

	var item models.MenuItemDetail
	database.DB.QueryRow(`
		SELECT id, name, price, COALESCE(markup_percent,0), COALESCE(food_cost,0)
		FROM menu_items WHERE id=$1
	`, id).Scan(&item.ID, &item.Name, &item.Price, &item.MarkupPercent, &item.FoodCost)

	c.JSON(http.StatusOK, item)
}

func GetInventoryLogs(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, COALESCE(ingredient_id,0), COALESCE(ingredient_name,''),
		       COALESCE(order_id,0), COALESCE(menu_item_id,0),
		       quantity_change, action, COALESCE(notes,''), created_at
		FROM inventory_logs
		ORDER BY created_at DESC LIMIT 200
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	logs := []models.InventoryLog{}
	for rows.Next() {
		var l models.InventoryLog
		rows.Scan(&l.ID, &l.IngredientID, &l.IngredientName,
			&l.OrderID, &l.MenuItemID, &l.QuantityChange,
			&l.Action, &l.Notes, &l.CreatedAt)
		logs = append(logs, l)
	}
	c.JSON(http.StatusOK, logs)
}
