#!/bin/bash

# Dual Bot Deployment Script
# Deploys both Triple Confirmation and MA Crossover bots to VPS

set -e  # Exit on any error

VPS_HOST="root@109.199.105.63"
VPS_DIR="/root/Oanda_Gold"

echo "========================================="
echo "🚀 DUAL BOT DEPLOYMENT"
echo "========================================="
echo ""

# Check if both .env files exist
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env for Triple Confirmation bot"
    exit 1
fi

if [ ! -f ".env.ma_crossover" ]; then
    echo "❌ Error: .env.ma_crossover file not found"
    echo "Please create .env.ma_crossover for MA Crossover bot"
    exit 1
fi

echo "✅ Configuration files found"
echo ""

# Add git commit if there are changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Uncommitted changes detected. Committing..."
    git add .
    read -p "Enter commit message: " commit_msg
    git commit -m "$commit_msg"
    echo ""
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main
echo "✅ Code pushed to GitHub"
echo ""

# Deploy to VPS
echo "🔄 Deploying to VPS..."
ssh $VPS_HOST << 'ENDSSH'
    cd /root/Oanda_Gold

    echo "📥 Pulling latest code..."
    git pull origin main

    echo "🛑 Stopping existing containers..."
    docker-compose -f docker-compose.dual.yml down

    echo "🏗️ Building Docker images..."
    docker-compose -f docker-compose.dual.yml build

    echo "🚀 Starting both bots..."
    docker-compose -f docker-compose.dual.yml up -d

    echo ""
    echo "========================================="
    echo "✅ BOTH BOTS DEPLOYED SUCCESSFULLY!"
    echo "========================================="
    echo ""
    echo "📊 Container Status:"
    docker ps | grep gold-bot

    echo ""
    echo "📝 Recent logs - Triple Confirmation Bot:"
    docker logs --tail 20 gold-bot-triple-confirmation

    echo ""
    echo "📝 Recent logs - MA Crossover Bot:"
    docker logs --tail 20 gold-bot-ma-crossover
ENDSSH

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "📱 Both bots should now be sending Telegram notifications"
echo ""
echo "Useful commands to run on VPS:"
echo "  docker logs -f gold-bot-triple-confirmation   # Follow Triple Confirmation bot logs"
echo "  docker logs -f gold-bot-ma-crossover          # Follow MA Crossover bot logs"
echo "  docker-compose -f docker-compose.dual.yml ps  # Check status"
echo "  docker-compose -f docker-compose.dual.yml down # Stop both bots"
echo ""
