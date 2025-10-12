#!/bin/bash

# PlantPal Quick Setup Script
# This script helps new users set up the environment quickly

echo "🌱 Welcome to PlantPal Setup!"
echo "================================"

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Skipping environment setup."
else
    echo "📄 Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created successfully!"
        echo "📝 Please edit .env file and update your MongoDB connection string."
    else
        echo "❌ .env.example not found. Creating basic .env..."
        cat > .env << EOL
# PlantPal Environment Configuration
MONGO_DB=mongodb://localhost:27017/plantpal
NODE_ENV=development
PORT=3001
EOL
        echo "✅ Basic .env file created!"
    fi
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔍 Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    echo "✅ MongoDB CLI (mongosh) is available"
else
    echo "⚠️  MongoDB CLI not found. Make sure MongoDB is installed."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your MongoDB connection string"
echo "2. Start MongoDB: brew services start mongodb-community (macOS)"
echo "3. Run the app: npm run dev"
echo "4. Visit: http://localhost:3001"
echo ""
echo "For troubleshooting, check the README.md file."