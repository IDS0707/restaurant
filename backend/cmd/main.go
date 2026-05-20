package main

import (
	"log"
	"os"

	"youit-backend/internal/database"
	"youit-backend/internal/handlers"
	"youit-backend/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	database.Connect()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// WebSocket
	r.GET("/ws", handlers.WSHandler)

	// Public routes
	api := r.Group("/api")
	{
		api.POST("/auth/login", handlers.Login)
		api.GET("/menu", handlers.GetMenu)
		api.GET("/orders/:code", handlers.GetOrderByCode)
		api.POST("/orders", handlers.CreateOrder)
		api.GET("/orders", handlers.GetOrders)
		api.PATCH("/orders/:id/status", handlers.UpdateOrderStatus)
		api.POST("/cards/scan", handlers.ScanCard)
		api.GET("/agents/code/:code", handlers.GetAgentByCode)
		api.GET("/agents/code/:code/history", handlers.GetAgentHistory)
	}

	// Admin routes (protected)
	admin := r.Group("/api/admin")
	admin.Use(middleware.AdminAuth())
	{
		// Menu
		admin.GET("/menu", handlers.GetMenu)
		admin.POST("/menu", handlers.CreateMenuItem)
		admin.PUT("/menu/:id", handlers.UpdateMenuItem)
		admin.DELETE("/menu/:id", handlers.DeleteMenuItem)
		admin.PATCH("/menu/:id/availability", handlers.ToggleMenuItemAvailability)

		// Menu detail & recipe
		admin.GET("/menu/:id/detail", handlers.GetMenuItemDetail)
		admin.POST("/menu/:id/recipe", handlers.AddRecipeItem)
		admin.PATCH("/menu/:id/markup", handlers.UpdateMenuMarkup)

		// Recipe item deletion (by recipe_item id)
		admin.DELETE("/recipe/:id", handlers.DeleteRecipeItem)

		// Orders
		admin.GET("/orders", handlers.GetOrders)

		// Analytics & expenses
		admin.GET("/analytics", handlers.GetAnalytics)
		admin.POST("/expenses", handlers.CreateExpense)
		admin.GET("/expenses", handlers.GetExpenses)

		// Inventory
		admin.GET("/ingredients", handlers.GetIngredients)
		admin.POST("/ingredients", handlers.CreateIngredient)
		admin.PUT("/ingredients/:id", handlers.UpdateIngredient)
		admin.POST("/ingredients/:id/restock", handlers.RestockIngredient)
		admin.DELETE("/ingredients/:id", handlers.DeleteIngredient)
		admin.GET("/inventory/logs", handlers.GetInventoryLogs)

		// Agents
		admin.GET("/agents", handlers.GetAgents)
		admin.POST("/agents", handlers.CreateAgent)
		admin.GET("/agents/:id", handlers.GetAgentDetail)
		admin.PUT("/agents/:id", handlers.UpdateAgent)
		admin.GET("/agents/:id/bonuses", handlers.GetAgentBonuses)
		admin.DELETE("/agents/:id", handlers.DeleteAgent)

		// Promo QR discount
		admin.GET("/promo", handlers.GetPromoDiscount)
		admin.PUT("/promo/:id", handlers.UpdatePromoDiscount)

		// VIP cards
		admin.GET("/vip", handlers.GetVipCards)
		admin.POST("/vip", handlers.CreateVipCard)
		admin.PUT("/vip/:id", handlers.UpdateVipCard)
		admin.DELETE("/vip/:id", handlers.DeleteVipCard)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("YouIt Backend running on :%s", port)
	r.Run(":" + port)
}
