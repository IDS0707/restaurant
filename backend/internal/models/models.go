package models

import "time"

type MenuItem struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Price         float64   `json:"price"`
	CostPrice     float64   `json:"cost_price"`
	Category      string    `json:"category"`
	ImageURL      string    `json:"image_url"`
	Available     bool      `json:"available"`
	MarkupPercent float64   `json:"markup_percent"`
	FoodCost      float64   `json:"food_cost"`
	CreatedAt     time.Time `json:"created_at"`
}

type MenuItemDetail struct {
	ID            int                `json:"id"`
	Name          string             `json:"name"`
	Description   string             `json:"description"`
	Price         float64            `json:"price"`
	Category      string             `json:"category"`
	ImageURL      string             `json:"image_url"`
	Available     bool               `json:"available"`
	MarkupPercent float64            `json:"markup_percent"`
	FoodCost      float64            `json:"food_cost"`
	SalePrice     float64            `json:"sale_price"`
	Recipe        []RecipeItemDetail `json:"recipe"`
	CreatedAt     time.Time          `json:"created_at"`
}

type Order struct {
	ID             int         `json:"id"`
	OrderCode      string      `json:"order_code"`
	TotalPrice     float64     `json:"total_price"`
	DiscountAmount float64     `json:"discount_amount"`
	FinalPrice     float64     `json:"final_price"`
	Status         string      `json:"status"`
	CardCode       string      `json:"card_code"`
	Note           string      `json:"note"`
	Items          []OrderItem `json:"items,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type OrderItem struct {
	ID         int     `json:"id"`
	OrderID    int     `json:"order_id"`
	MenuItemID int     `json:"menu_item_id"`
	ItemName   string  `json:"item_name"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
}

type ReferralAgent struct {
	ID                     int            `json:"id"`
	Code                   string         `json:"code"`
	Name                   string         `json:"name"`
	Phone                  string         `json:"phone"`
	GoldCardCode           string         `json:"gold_card_code"`
	RegularCardCount       int            `json:"regular_card_count"`
	DiscountAmount         float64        `json:"discount_amount"`
	BonusThreshold         int            `json:"bonus_threshold"`
	ReferralBonusThreshold int            `json:"referral_bonus_threshold"`
	GoldCardUses           int            `json:"gold_card_uses"`
	ReferralCardTotalUses  int            `json:"referral_card_total_uses"`
	TotalBonusEarned       int            `json:"total_bonus_earned"`
	IsActive               bool           `json:"is_active"`
	Cards                  []ReferralCard `json:"cards,omitempty"`
	CreatedAt              time.Time      `json:"created_at"`
}

type ReferralCard struct {
	ID        int       `json:"id"`
	AgentID   int       `json:"agent_id"`
	CardCode  string    `json:"card_code"`
	CardType  string    `json:"card_type"`
	UseCount  int       `json:"use_count"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type CardTransaction struct {
	ID              int       `json:"id"`
	CardID          int       `json:"card_id"`
	OrderID         int       `json:"order_id"`
	AgentID         int       `json:"agent_id"`
	DiscountApplied float64   `json:"discount_applied"`
	CreatedAt       time.Time `json:"created_at"`
}

type AgentBonus struct {
	ID          int       `json:"id"`
	AgentID     int       `json:"agent_id"`
	BonusType   string    `json:"bonus_type"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	Used        bool      `json:"used"`
	CreatedAt   time.Time `json:"created_at"`
}

type Expense struct {
	ID          int       `json:"id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	Category    string    `json:"category"`
	ExpenseType string    `json:"expense_type"`
	IsRecurring bool      `json:"is_recurring"`
	CreatedAt   time.Time `json:"created_at"`
}

type Analytics struct {
	TotalRevenue    float64        `json:"total_revenue"`
	TotalDiscount   float64        `json:"total_discount"`
	TotalExpenses   float64        `json:"total_expenses"`
	MonthlyExpenses float64        `json:"monthly_expenses"`
	NetProfit       float64        `json:"net_profit"`
	TotalOrders     int            `json:"total_orders"`
	TodayOrders     int            `json:"today_orders"`
	TodayRevenue    float64        `json:"today_revenue"`
	PopularItems    []PopularItem  `json:"popular_items"`
	DailyRevenue    []DailyRevenue `json:"daily_revenue"`
	HourlyRevenue   []HourlyRevenue `json:"hourly_revenue"`
	CategorySales   []CategorySale `json:"category_sales"`
}

type HourlyRevenue struct {
	Hour    int     `json:"hour"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
}

type PopularItem struct {
	MenuItemID int     `json:"menu_item_id"`
	Name       string  `json:"name"`
	TotalSold  int     `json:"total_sold"`
	Revenue    float64 `json:"revenue"`
}

type DailyRevenue struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
}

type CategorySale struct {
	Category string  `json:"category"`
	Revenue  float64 `json:"revenue"`
	Count    int     `json:"count"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Inventory models

type Ingredient struct {
	ID                int       `json:"id"`
	Name              string    `json:"name"`
	Category          string    `json:"category"`
	MeasurementUnit   string    `json:"measurement_unit"`
	Quantity          float64   `json:"quantity"`
	UnitPrice         float64   `json:"unit_price"`
	TotalCost         float64   `json:"total_cost"`
	LowStockThreshold float64   `json:"low_stock_threshold"`
	IsLowStock        bool      `json:"is_low_stock"`
	CreatedAt         time.Time `json:"created_at"`
}

type IngredientPurchase struct {
	ID               int       `json:"id"`
	IngredientID     int       `json:"ingredient_id"`
	QuantityPurchased float64  `json:"quantity_purchased"`
	UnitPrice        float64   `json:"unit_price"`
	TotalCost        float64   `json:"total_cost"`
	Notes            string    `json:"notes"`
	CreatedAt        time.Time `json:"created_at"`
}

type RecipeItemDetail struct {
	ID             int     `json:"id"`
	MenuItemID     int     `json:"menu_item_id"`
	IngredientID   int     `json:"ingredient_id"`
	IngredientName string  `json:"ingredient_name"`
	QuantityUsed   float64 `json:"quantity_used"`
	Unit           string  `json:"unit"`
	IngredientUnit string  `json:"ingredient_unit"`
	UnitPrice      float64 `json:"unit_price"`
	Cost           float64 `json:"cost"`
}

type PromoDiscount struct {
	ID             int       `json:"id"`
	Code           string    `json:"code"`
	DiscountAmount float64   `json:"discount_amount"`
	IsActive       bool      `json:"is_active"`
	UsageLimit     int       `json:"usage_limit"`
	UseCount       int       `json:"use_count"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type InventoryLog struct {
	ID             int       `json:"id"`
	IngredientID   int       `json:"ingredient_id"`
	IngredientName string    `json:"ingredient_name"`
	OrderID        int       `json:"order_id"`
	MenuItemID     int       `json:"menu_item_id"`
	QuantityChange float64   `json:"quantity_change"`
	Action         string    `json:"action"`
	Notes          string    `json:"notes"`
	CreatedAt      time.Time `json:"created_at"`
}
