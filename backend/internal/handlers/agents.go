package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"youit-backend/internal/database"
	"youit-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type CreateAgentRequest struct {
	Name                   string  `json:"name" binding:"required"`
	Phone                  string  `json:"phone"`
	RegularCardCount       int     `json:"regular_card_count"`
	DiscountAmount         float64 `json:"discount_amount"`
	BonusThreshold         int     `json:"bonus_threshold"`
	ReferralBonusThreshold int     `json:"referral_bonus_threshold"`
}

func generateUniqueCode(length int, table, column string) string {
	rand.Seed(time.Now().UnixNano())
	for {
		format := fmt.Sprintf("%%0%dd", length)
		max := 1
		for i := 0; i < length; i++ {
			max *= 10
		}
		code := fmt.Sprintf(format, rand.Intn(max-int(max/10))+int(max/10))
		var exists bool
		database.DB.QueryRow(fmt.Sprintf(`SELECT EXISTS(SELECT 1 FROM %s WHERE %s=$1)`, table, column), code).Scan(&exists)
		if !exists {
			return code
		}
	}
}

func CreateAgent(c *gin.Context) {
	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Phone != "" {
		var exists bool
		database.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM referral_agents WHERE phone=$1)`, req.Phone).Scan(&exists)
		if exists {
			c.JSON(http.StatusConflict, gin.H{"error": "Бу телефон рақами аллақачон рўйхатга олинган"})
			return
		}
	}

	if req.RegularCardCount == 0 {
		req.RegularCardCount = 20
	}
	if req.DiscountAmount == 0 {
		req.DiscountAmount = 20000
	}
	if req.BonusThreshold == 0 {
		req.BonusThreshold = 10
	}
	if req.ReferralBonusThreshold == 0 {
		req.ReferralBonusThreshold = 20
	}

	agentCode := generateUniqueCode(7, "referral_agents", "code")
	goldCardCode := "GOLD-" + generateUniqueCode(8, "referral_cards", "card_code")

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}
	defer tx.Rollback()

	var agentID int
	err = tx.QueryRow(
		`INSERT INTO referral_agents (code, name, phone, gold_card_code, regular_card_count, discount_amount, bonus_threshold, referral_bonus_threshold)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		agentCode, req.Name, req.Phone, goldCardCode,
		req.RegularCardCount, req.DiscountAmount, req.BonusThreshold, req.ReferralBonusThreshold,
	).Scan(&agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Exec(
		`INSERT INTO referral_cards (agent_id, card_code, card_type) VALUES ($1,$2,'gold')`,
		agentID, goldCardCode,
	)

	for i := 0; i < req.RegularCardCount; i++ {
		cardCode := fmt.Sprintf("REG-%s-%02d", generateUniqueCode(6, "referral_cards", "card_code"), i+1)
		tx.Exec(
			`INSERT INTO referral_cards (agent_id, card_code, card_type) VALUES ($1,$2,'regular')`,
			agentID, cardCode,
		)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
		return
	}

	agent := GetAgentByID(agentID)
	BroadcastMessage("agent_created", agent)
	c.JSON(http.StatusCreated, agent)
}

func GetAgentByID(agentID int) *models.ReferralAgent {
	agent := &models.ReferralAgent{}
	err := database.DB.QueryRow(
		`SELECT id, code, name, COALESCE(phone,''), gold_card_code, regular_card_count,
		 discount_amount, bonus_threshold, referral_bonus_threshold, gold_card_uses,
		 referral_card_total_uses, total_bonus_earned, is_active, created_at
		 FROM referral_agents WHERE id=$1`, agentID,
	).Scan(&agent.ID, &agent.Code, &agent.Name, &agent.Phone, &agent.GoldCardCode,
		&agent.RegularCardCount, &agent.DiscountAmount, &agent.BonusThreshold,
		&agent.ReferralBonusThreshold, &agent.GoldCardUses, &agent.ReferralCardTotalUses,
		&agent.TotalBonusEarned, &agent.IsActive, &agent.CreatedAt)
	if err != nil {
		return nil
	}

	rows, _ := database.DB.Query(
		`SELECT id, agent_id, card_code, card_type, use_count, is_active, created_at
		 FROM referral_cards WHERE agent_id=$1 ORDER BY card_type DESC, id`, agentID,
	)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var card models.ReferralCard
			rows.Scan(&card.ID, &card.AgentID, &card.CardCode, &card.CardType, &card.UseCount, &card.IsActive, &card.CreatedAt)
			agent.Cards = append(agent.Cards, card)
		}
	}
	return agent
}

func GetAgentByCode(c *gin.Context) {
	code := c.Param("code")
	var agentID int
	var err error
	if strings.HasPrefix(strings.ToUpper(code), "GOLD-") {
		err = database.DB.QueryRow(
			`SELECT id FROM referral_agents WHERE UPPER(gold_card_code)=$1 AND is_active=true`,
			strings.ToUpper(code),
		).Scan(&agentID)
	} else {
		err = database.DB.QueryRow(
			`SELECT id FROM referral_agents WHERE code=$1 AND is_active=true`, code,
		).Scan(&agentID)
	}
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}
	agent := GetAgentByID(agentID)
	c.JSON(http.StatusOK, agent)
}

func GetAgents(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT id, code, name, COALESCE(phone,''), gold_card_code, regular_card_count,
		 discount_amount, bonus_threshold, referral_bonus_threshold, gold_card_uses,
		 referral_card_total_uses, total_bonus_earned, is_active, created_at
		 FROM referral_agents ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	agents := []models.ReferralAgent{}
	for rows.Next() {
		var a models.ReferralAgent
		rows.Scan(&a.ID, &a.Code, &a.Name, &a.Phone, &a.GoldCardCode,
			&a.RegularCardCount, &a.DiscountAmount, &a.BonusThreshold,
			&a.ReferralBonusThreshold, &a.GoldCardUses, &a.ReferralCardTotalUses,
			&a.TotalBonusEarned, &a.IsActive, &a.CreatedAt)
		agents = append(agents, a)
	}
	c.JSON(http.StatusOK, agents)
}

func GetAgentDetail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	agent := GetAgentByID(id)
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func ScanCard(c *gin.Context) {
	var body struct {
		CardCode  string  `json:"card_code" binding:"required"`
		OrderTotal float64 `json:"order_total"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var cardID, agentID int
	var cardType string
	var useCount int
	var isActive bool
	err := database.DB.QueryRow(
		`SELECT rc.id, rc.agent_id, rc.card_type, rc.use_count, rc.is_active
		 FROM referral_cards rc WHERE rc.card_code=$1`, body.CardCode,
	).Scan(&cardID, &agentID, &cardType, &useCount, &isActive)

	if err != nil {
		// Try as VIP card (all items free for that person)
		var vipFirst, vipLast string
		var vipActive bool
		vipErr := database.DB.QueryRow(
			`SELECT first_name, COALESCE(last_name,''), is_active
			 FROM vip_cards WHERE code=$1`, body.CardCode,
		).Scan(&vipFirst, &vipLast, &vipActive)
		if vipErr == nil {
			if !vipActive {
				c.JSON(http.StatusBadRequest, gin.H{"error": "VIP karta deaktivlashtirilgan"})
				return
			}
			fullName := strings.TrimSpace(vipFirst + " " + vipLast)
			c.JSON(http.StatusOK, gin.H{
				"card_id":     0,
				"agent_id":    0,
				"agent_name":  "VIP: " + fullName,
				"card_type":   "vip",
				"use_count":   0,
				"discount":    body.OrderTotal, // tekin
				"bonus_ready": false,
				"valid":       true,
			})
			return
		}

		// Try as promo QR/typed code (case-insensitive on the code)
		var promoDiscount float64
		var promoType string
		var promoActive bool
		var promoLimit, promoUseCount int
		var promoValidUntil *time.Time
		promoErr := database.DB.QueryRow(
			`SELECT discount_amount, COALESCE(discount_type,'amount'), is_active,
			        COALESCE(usage_limit,0), COALESCE(use_count,0), valid_until
			 FROM promo_discount WHERE UPPER(code)=UPPER($1)`,
			body.CardCode,
		).Scan(&promoDiscount, &promoType, &promoActive, &promoLimit, &promoUseCount, &promoValidUntil)
		if promoErr == nil {
			if !promoActive {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Promo deaktivlashtirilgan"})
				return
			}
			if promoValidUntil != nil && time.Now().After(*promoValidUntil) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Promo muddati tugagan"})
				return
			}
			if promoLimit > 0 && promoUseCount >= promoLimit {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Promo muddati tugagan"})
				return
			}
			var discount float64
			if promoType == "percent" {
				discount = body.OrderTotal * promoDiscount / 100.0
			} else {
				discount = promoDiscount
			}
			if discount > body.OrderTotal && body.OrderTotal > 0 {
				discount = body.OrderTotal
			}
			c.JSON(http.StatusOK, gin.H{
				"card_id":       0,
				"agent_id":      0,
				"agent_name":    "Promo chegirma",
				"card_type":     "promo",
				"discount_type": promoType,
				"use_count":     promoUseCount,
				"usage_limit":   promoLimit,
				"discount":      discount,
				"bonus_ready":   false,
				"valid":         true,
			})
			return
		}

		// Try as 7-digit agent personal code — use the agent's gold card
		var goldCardCode string
		err2 := database.DB.QueryRow(
			`SELECT id, gold_card_code FROM referral_agents WHERE code=$1 AND is_active=true`,
			body.CardCode,
		).Scan(&agentID, &goldCardCode)
		if err2 != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Karta yoki agent topilmadi"})
			return
		}
		err = database.DB.QueryRow(
			`SELECT id, agent_id, card_type, use_count, is_active
			 FROM referral_cards WHERE card_code=$1`, goldCardCode,
		).Scan(&cardID, &agentID, &cardType, &useCount, &isActive)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Gold karta topilmadi"})
			return
		}
	}

	if !isActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Karta deaktivlashtirilgan"})
		return
	}

	var discountAmount float64
	var bonusThreshold int
	var agentName string
	database.DB.QueryRow(
		`SELECT discount_amount, bonus_threshold, name FROM referral_agents WHERE id=$1`, agentID,
	).Scan(&discountAmount, &bonusThreshold, &agentName)

	var discount float64
	var bonusReady bool

	if cardType == "gold" {
		discount = discountAmount
		if discount > body.OrderTotal && body.OrderTotal > 0 {
			discount = body.OrderTotal
		}
		bonusReady = (useCount+1)%bonusThreshold == 0 && useCount > 0
	} else {
		discount = discountAmount * 0.05
		if discount > body.OrderTotal && body.OrderTotal > 0 {
			discount = body.OrderTotal
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"card_id":       cardID,
		"agent_id":      agentID,
		"agent_name":    agentName,
		"card_type":     cardType,
		"use_count":     useCount,
		"discount":      discount,
		"bonus_ready":   bonusReady,
		"valid":         true,
	})
}

func GetAgentBonuses(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	rows, err := database.DB.Query(
		`SELECT id, agent_id, bonus_type, amount, description, used, created_at
		 FROM agent_bonuses WHERE agent_id=$1 ORDER BY created_at DESC`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	bonuses := []models.AgentBonus{}
	for rows.Next() {
		var b models.AgentBonus
		rows.Scan(&b.ID, &b.AgentID, &b.BonusType, &b.Amount, &b.Description, &b.Used, &b.CreatedAt)
		bonuses = append(bonuses, b)
	}
	c.JSON(http.StatusOK, bonuses)
}

func UpdateAgent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var body struct {
		Name                   string  `json:"name"`
		Phone                  string  `json:"phone"`
		DiscountAmount         float64 `json:"discount_amount"`
		BonusThreshold         int     `json:"bonus_threshold"`
		ReferralBonusThreshold int     `json:"referral_bonus_threshold"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if body.Phone != "" {
		var existingID int
		database.DB.QueryRow(
			`SELECT id FROM referral_agents WHERE phone=$1 AND id!=$2`, body.Phone, id,
		).Scan(&existingID)
		if existingID != 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Bu telefon raqami boshqa agentga tegishli"})
			return
		}
	}

	_, err := database.DB.Exec(
		`UPDATE referral_agents SET name=$1, phone=$2, discount_amount=$3, bonus_threshold=$4, referral_bonus_threshold=$5 WHERE id=$6`,
		body.Name, body.Phone, body.DiscountAmount, body.BonusThreshold, body.ReferralBonusThreshold, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	agent := GetAgentByID(id)
	if agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func DeleteAgent(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction error"})
		return
	}
	defer tx.Rollback()

	tx.Exec(`DELETE FROM card_transactions WHERE agent_id=$1`, id)
	tx.Exec(`DELETE FROM agent_bonuses WHERE agent_id=$1`, id)
	tx.Exec(`DELETE FROM referral_cards WHERE agent_id=$1`, id)

	result, err := tx.Exec(`DELETE FROM referral_agents WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent deleted"})
}

func GetAgentHistory(c *gin.Context) {
	code := c.Param("code")
	var agentID int
	err := database.DB.QueryRow(`SELECT id FROM referral_agents WHERE code=$1`, code).Scan(&agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	rows, err := database.DB.Query(
		`SELECT ct.id, ct.card_id, ct.order_id, o.order_code, rc.card_type,
		        ct.discount_applied, ct.created_at
		 FROM card_transactions ct
		 JOIN orders o ON ct.order_id=o.id
		 JOIN referral_cards rc ON ct.card_id=rc.id
		 WHERE ct.agent_id=$1 ORDER BY ct.created_at DESC LIMIT 100`, agentID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type HistoryItem struct {
		ID              int       `json:"id"`
		CardID          int       `json:"card_id"`
		OrderID         int       `json:"order_id"`
		OrderCode       string    `json:"order_code"`
		CardType        string    `json:"card_type"`
		DiscountApplied float64   `json:"discount_applied"`
		CreatedAt       time.Time `json:"created_at"`
	}

	history := []HistoryItem{}
	for rows.Next() {
		var h HistoryItem
		rows.Scan(&h.ID, &h.CardID, &h.OrderID, &h.OrderCode, &h.CardType, &h.DiscountApplied, &h.CreatedAt)
		history = append(history, h)
	}
	c.JSON(http.StatusOK, history)
}
