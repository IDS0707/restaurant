package handlers

import (
	"fmt"
	"net/http"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetAnalytics(c *gin.Context) {
	period := c.Query("period")
	customDate := c.Query("date") // e.g. "2026-05-11"
	if period == "" && customDate == "" {
		period = "month"
	}

	var dateFilter string
	if customDate != "" {
		dateFilter = fmt.Sprintf("DATE(created_at) = '%s'", customDate)
		period = "custom"
	} else {
		switch period {
		case "today":
			dateFilter = "DATE(created_at) = CURRENT_DATE"
		case "week":
			dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'"
		case "month":
			dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'"
		case "year":
			dateFilter = "created_at >= CURRENT_DATE - INTERVAL '365 days'"
		default:
			dateFilter = "1=1"
		}
	}

	analytics := models.Analytics{}

	database.DB.QueryRow(
		`SELECT COALESCE(SUM(final_price),0), COALESCE(SUM(discount_amount),0), COUNT(*)
		 FROM orders WHERE status != 'pending' AND ` + dateFilter,
	).Scan(&analytics.TotalRevenue, &analytics.TotalDiscount, &analytics.TotalOrders)

	database.DB.QueryRow(
		`SELECT COALESCE(SUM(final_price),0), COUNT(*)
		 FROM orders WHERE status != 'pending' AND DATE(created_at) = CURRENT_DATE`,
	).Scan(&analytics.TodayRevenue, &analytics.TodayOrders)

	// One-time expenses within the period
	var oneTimeExpenses float64
	database.DB.QueryRow(
		`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE COALESCE(is_recurring,false)=false AND ` + dateFilter,
	).Scan(&oneTimeExpenses)

	// Monthly recurring expenses (always active)
	database.DB.QueryRow(
		`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE COALESCE(is_recurring,false)=true`,
	).Scan(&analytics.MonthlyExpenses)

	// Scale recurring expenses to the selected period
	var recurringPortion float64
	switch period {
	case "today":
		recurringPortion = analytics.MonthlyExpenses / 30.0
	case "week":
		recurringPortion = analytics.MonthlyExpenses * 7.0 / 30.0
	case "month":
		recurringPortion = analytics.MonthlyExpenses
	case "year":
		recurringPortion = analytics.MonthlyExpenses * 12.0
	default:
		recurringPortion = analytics.MonthlyExpenses
	}

	analytics.TotalExpenses = oneTimeExpenses + recurringPortion
	analytics.NetProfit = analytics.TotalRevenue - analytics.TotalExpenses

	rows, _ := database.DB.Query(
		`SELECT COALESCE(MIN(oi.menu_item_id), 0), oi.item_name, SUM(oi.quantity) as total_sold,
		        SUM(oi.quantity * oi.unit_price) as revenue
		 FROM order_items oi
		 JOIN orders o ON oi.order_id=o.id
		 WHERE o.status != 'pending' AND ` + dateFilter + `
		 GROUP BY oi.item_name
		 ORDER BY total_sold DESC LIMIT 10`,
	)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var p models.PopularItem
			rows.Scan(&p.MenuItemID, &p.Name, &p.TotalSold, &p.Revenue)
			analytics.PopularItems = append(analytics.PopularItems, p)
		}
	}

	dailyRows, _ := database.DB.Query(
		`SELECT TO_CHAR(DATE(created_at),'YYYY-MM-DD'), COALESCE(SUM(final_price),0), COUNT(*)
		 FROM orders WHERE status != 'pending' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
		 GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
	)
	if dailyRows != nil {
		defer dailyRows.Close()
		for dailyRows.Next() {
			var d models.DailyRevenue
			dailyRows.Scan(&d.Date, &d.Revenue, &d.Orders)
			analytics.DailyRevenue = append(analytics.DailyRevenue, d)
		}
	}

	// Hourly breakdown for today or a single custom date
	if period == "today" || period == "custom" {
		hourlyRows, _ := database.DB.Query(
			`SELECT EXTRACT(HOUR FROM created_at)::int,
			        COALESCE(SUM(final_price),0), COUNT(*)
			 FROM orders WHERE status != 'pending' AND `+dateFilter+`
			 GROUP BY EXTRACT(HOUR FROM created_at)
			 ORDER BY 1`,
		)
		if hourlyRows != nil {
			defer hourlyRows.Close()
			for hourlyRows.Next() {
				var h models.HourlyRevenue
				hourlyRows.Scan(&h.Hour, &h.Revenue, &h.Orders)
				analytics.HourlyRevenue = append(analytics.HourlyRevenue, h)
			}
		}
	}

	catRows, _ := database.DB.Query(
		`SELECT COALESCE(mi.category, 'Boshqa'), COALESCE(SUM(oi.quantity * oi.unit_price),0), COALESCE(SUM(oi.quantity),0)
		 FROM order_items oi
		 JOIN orders o ON oi.order_id=o.id
		 LEFT JOIN menu_items mi ON oi.menu_item_id=mi.id
		 WHERE o.status != 'pending' AND ` + dateFilter + `
		 GROUP BY COALESCE(mi.category, 'Boshqa') ORDER BY SUM(oi.quantity * oi.unit_price) DESC`,
	)
	if catRows != nil {
		defer catRows.Close()
		for catRows.Next() {
			var cs models.CategorySale
			catRows.Scan(&cs.Category, &cs.Revenue, &cs.Count)
			analytics.CategorySales = append(analytics.CategorySales, cs)
		}
	}

	c.JSON(http.StatusOK, analytics)
}

func CreateExpense(c *gin.Context) {
	var exp models.Expense
	if err := c.ShouldBindJSON(&exp); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}
	if exp.ExpenseType == "" {
		exp.ExpenseType = "one_time"
	}
	err := database.DB.QueryRow(
		`INSERT INTO expenses (description, amount, category, expense_type, is_recurring)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		exp.Description, exp.Amount, exp.Category, exp.ExpenseType, exp.IsRecurring,
	).Scan(&exp.ID, &exp.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, exp)
}

func GetExpenses(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, description, amount, category,
		        COALESCE(expense_type,'one_time'), COALESCE(is_recurring,false), created_at
		 FROM expenses ORDER BY is_recurring DESC, created_at DESC LIMIT 100`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	expenses := []models.Expense{}
	for rows.Next() {
		var e models.Expense
		rows.Scan(&e.ID, &e.Description, &e.Amount, &e.Category, &e.ExpenseType, &e.IsRecurring, &e.CreatedAt)
		expenses = append(expenses, e)
	}
	c.JSON(http.StatusOK, expenses)
}
