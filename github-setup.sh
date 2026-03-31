#!/bin/bash

# GitHub Repository Setup Script for Chaos Coordinator
# This script helps you create a private GitHub repository and push your code

echo "🚀 Chaos Coordinator - GitHub Repository Setup"
echo "=============================================="

# Repository details
REPO_NAME="chaos-coordinator"
DESCRIPTION="Cross-functional project management and coordination platform with AI-powered workflows"

echo ""
echo "📋 Repository Details:"
echo "   Name: $REPO_NAME"
echo "   Description: $DESCRIPTION"
echo "   Visibility: Private"
echo ""

echo "🔧 Step 1: Follow these manual steps on GitHub:"
echo "--------------------------------------------"
echo "1. Go to https://github.com/new"
echo "2. Repository name: chaos-coordinator"
echo "3. Description: $DESCRIPTION"
echo "4. Set to Private 🔒"
echo "5. DO NOT initialize with README, .gitignore, or license"
echo "6. Click 'Create repository'"
echo ""

echo "⚠️  IMPORTANT: After creating the repository, GitHub will show you commands."
echo "   Look for the '…or push an existing repository from the command line' section."
echo ""

echo "🔧 Step 2: Once you create the repo on GitHub, run these commands:"
echo "----------------------------------------------------------------"
echo "git remote add origin https://github.com/YOUR_USERNAME/chaos-coordinator.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""

echo "📝 Replace YOUR_USERNAME with your actual GitHub username"
echo ""

echo "🔧 Step 3: Alternative - Use SSH (recommended):"
echo "---------------------------------------------"
echo "If you have SSH keys set up:"
echo "git remote add origin git@github.com:YOUR_USERNAME/chaos-coordinator.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""

echo "✅ Your local repository is ready!"
echo "   - Git initialized"
echo "   - All files committed"
echo "   - Ready to push to GitHub"
echo ""

echo "🎯 Next Steps:"
echo "1. Create the private repository on GitHub"
echo "2. Replace YOUR_USERNAME in the commands above"
echo "3. Run the git commands to push your code"
echo ""

echo "🔒 Security Note:"
echo "   Your repository contains sensitive configuration files."
echo "   Keeping it private is recommended for security."
