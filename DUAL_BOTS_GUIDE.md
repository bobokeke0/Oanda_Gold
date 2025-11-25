# Dual Strategy Bot Setup Guide

## Overview

This setup runs two independent gold trading bots simultaneously:

1. **Triple Confirmation Bot** - Original strategy with trend/momentum/entry confirmation
2. **MA Crossover Bot** - Simple 5/20 SMA crossover strategy

Each bot trades on a separate Oanda account, allowing direct performance comparison.

---

## Account Configuration

### Bot 1: Triple Confirmation
- **Account**: 101-004-5540053-001
- **Strategy**: Triple Confirmation Trend Follower
- **Config File**: `.env`
- **Container Name**: `gold-bot-triple-confirmation`
- **Logs**: `./logs/`
- **Risk**: 0.5% per trade
- **Filters**: $10 EMA separation, 70% min confidence

### Bot 2: MA Crossover
- **Account**: 101-004-36282386-002 (Gold_SMA)
- **Strategy**: MA Crossover (5/20 SMA)
- **Config File**: `.env.ma_crossover`
- **Container Name**: `gold-bot-ma-crossover`
- **Logs**: `./logs_ma/`
- **Risk**: 0.5% per trade
- **Filters**: 50% min confidence (less strict)

---

## Deployment

### Deploy Both Bots

```bash
./deploy_dual_bots.sh
```

This script will:
1. Commit any changes to git
2. Push to GitHub
3. Pull on VPS
4. Stop existing containers
5. Build and start both bots

### Deploy Single Bot

If you only want to deploy one bot:

```bash
# Triple Confirmation only
docker-compose up -d gold-bot

# MA Crossover only (using dual config)
docker-compose -f docker-compose.dual.yml up -d gold-bot-ma
```

---

## Monitoring

### View Logs

```bash
# Triple Confirmation Bot
docker logs -f gold-bot-triple-confirmation

# MA Crossover Bot
docker logs -f gold-bot-ma-crossover

# Both (side by side)
docker logs -f gold-bot-triple-confirmation & docker logs -f gold-bot-ma-crossover
```

### Check Container Status

```bash
docker-compose -f docker-compose.dual.yml ps
```

### Stop Bots

```bash
# Stop both
docker-compose -f docker-compose.dual.yml down

# Stop one
docker stop gold-bot-triple-confirmation
docker stop gold-bot-ma-crossover
```

---

## Performance Comparison

### Generate Comparison Report

Run the comparison script to see head-to-head performance:

```bash
node src/compare_strategies.js
```

Output includes:
- Balance comparison
- Win rate comparison
- Total P&L comparison
- Profit factor comparison
- Trade statistics for each bot

### Telegram Notifications

Both bots send notifications to the same Telegram chat. Each notification is prefixed with the bot name:
- "Gold Triple Confirmation Bot"
- "Gold MA Crossover Bot"

---

## Strategy Differences

### Triple Confirmation Strategy

**Entry Requirements**:
1. Trend aligned (20 EMA vs 50 EMA)
2. RSI in valid range
3. Candlestick pattern confirmation
4. Min $10 EMA separation (anti-chop filter)
5. 70% minimum confidence score

**Pros**:
- More selective (fewer trades)
- Higher confidence setups
- Trend-following proven approach

**Cons**:
- Can miss quick moves
- More complex logic

### MA Crossover Strategy

**Entry Requirements**:
1. 5 SMA crosses 20 SMA
2. 50% minimum confidence

**Exit**:
- Price closes back through 20 SMA

**Pros**:
- Simple and reactive
- Catches trend changes quickly
- Classic proven strategy

**Cons**:
- More trades (some whipsaws)
- No RSI filter (can enter overbought/oversold)

---

## Configuration Changes

### Modify Triple Confirmation Bot

Edit `.env` and redeploy:

```bash
./deploy_dual_bots.sh
```

### Modify MA Crossover Bot

Edit `.env.ma_crossover` and redeploy:

```bash
./deploy_dual_bots.sh
```

### Common Settings to Adjust

```bash
# Risk per trade (0.5% = 0.005, 1% = 0.01)
MAX_RISK_PER_TRADE=0.005

# Stop loss distance
STOP_LOSS_PIPS=300  # $3.00

# Minimum confidence for entry
MIN_CONFIDENCE=70   # Skip setups below 70%

# Trailing stop
ENABLE_TRAILING_STOP=true
TRAILING_STOP_DISTANCE_PIPS=200
```

---

## Telegram Commands

Both bots respond to these commands:

- `/status` - Current account balance and open positions
- `/balance` - Account balance and P&L
- `/positions` - List open positions
- `/trades` - Recent closed trades
- `/performance` - Win rate and statistics
- `/pause` - Pause new trades (emergency stop)
- `/resume` - Resume trading
- `/compare` - Compare both strategies (if implemented)

---

## Troubleshooting

### Bot Not Starting

1. Check logs: `docker logs gold-bot-triple-confirmation`
2. Verify .env file has correct API credentials
3. Check Oanda API status
4. Ensure account ID is correct

### No Telegram Notifications

1. Verify `ENABLE_TELEGRAM=true` in .env
2. Check `TELEGRAM_BOT_TOKEN` is correct
3. Check `TELEGRAM_CHAT_ID` is correct
4. Test with `/status` command

### Bots Conflict

Both bots should run independently without conflict:
- Different account IDs
- Separate log directories
- Separate database files

If conflicts occur:
1. Check container names are unique
2. Check port mappings (none needed for this setup)
3. Check volume mounts don't overlap

---

## Daily Workflow

1. **Morning**: Check comparison report
   ```bash
   ssh root@109.199.105.63 "cd /root/Oanda_Gold && node src/compare_strategies.js"
   ```

2. **Throughout Day**: Monitor Telegram notifications from both bots

3. **Evening**: Review logs and performance
   ```bash
   # Check both bot logs
   ssh root@109.199.105.63 "docker logs --tail 50 gold-bot-triple-confirmation"
   ssh root@109.199.105.63 "docker logs --tail 50 gold-bot-ma-crossover"
   ```

4. **Weekly**: Generate full comparison report and adjust if needed

---

## File Structure

```
Oanda_Gold/
├── .env                          # Triple Confirmation config
├── .env.ma_crossover             # MA Crossover config
├── docker-compose.yml            # Single bot deployment (legacy)
├── docker-compose.dual.yml       # Dual bot deployment (NEW)
├── deploy_dual_bots.sh           # Deployment script (NEW)
├── DUAL_BOTS_GUIDE.md            # This file (NEW)
├── src/
│   ├── index.js                  # Main bot (now strategy-agnostic)
│   ├── strategy.js               # Triple Confirmation strategy
│   ├── ma_crossover_strategy.js  # MA Crossover strategy (NEW)
│   ├── strategy_tracker.js       # Performance tracking (NEW)
│   ├── compare_strategies.js     # Comparison reporter (NEW)
│   └── ...                       # Other components
├── logs/                         # Triple Confirmation logs
├── logs_ma/                      # MA Crossover logs
├── data/                         # Triple Confirmation database
└── data_ma/                      # MA Crossover database
```

---

## Next Steps

1. ✅ Deploy both bots: `./deploy_dual_bots.sh`
2. ✅ Verify Telegram notifications from both
3. ✅ Run initial comparison: `node src/compare_strategies.js`
4. ⏳ Monitor for 1 week
5. ⏳ Analyze which strategy performs better
6. ⏳ Adjust risk/filters based on results
7. ⏳ After 1 month, decide which to focus on

---

## Important Notes

- Both bots start with 0.5% risk (conservative)
- Triple Confirmation has stricter filters (fewer trades)
- MA Crossover is more reactive (more trades)
- Both use same stop loss ($3.00) and R:R ratios (1.5R/2.5R)
- Both have trailing stops enabled
- All trading is on practice accounts initially

**Remember**: The goal is to find which strategy works best for gold, then scale that one up!
