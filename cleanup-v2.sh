#!/bin/bash

# Chaos Coordinator v2.0 Cleanup Script
# Keeps only necessary files for v2.0, removes everything else

echo "🧹 Cleaning up Chaos Coordinator for v2.0..."

# Navigate to server directory
cd server

# Backup current index.js (just in case)
cp index.js index.js.backup

# Keep only essential files for v2.0
echo "📁 Keeping essential files for v2.0..."

# Keep the new enhanced server file
if [ -f "index-new.js" ]; then
    echo "✅ Keeping enhanced server (index-new.js)"
    cp index-new.js index.js
else
    echo "❌ Enhanced server not found, keeping original"
fi

# Keep essential directories in modules/
MODULES_TO_KEEP=("auth" "dashboard" "lifecycle" "tasks" "projects" "handover" "milestones" "sla")

for dir in modules/*/; do
    dir_name=$(basename "$dir")
    if [[ " ${MODULES_TO_KEEP[*]} " =~ " ${dir_name} " ]]; then
        echo "✅ Keeping module: $dir_name"
    else
        echo "🗑️ Removing module: $dir_name"
        rm -rf "$dir"
    fi
done

# Keep essential routes
ROUTES_TO_KEEP=("auth.js" "dashboard.js" "projects.js" "tasks.js" "handoff.js")

for route in routes/*/; do
    route_name=$(basename "$route")
    if [[ " ${ROUTES_TO_KEEP[*]} " =~ " ${route_name} " ]]; then
        echo "✅ Keeping route: $route_name"
    else
        echo "🗑️ Removing route: $route_name"
        rm -rf "$route"
    fi
done

# Keep essential services
SERVICES_TO_KEEP=("crmIntegration.js" "notificationScheduler.js")

for service in services/*/; do
    service_name=$(basename "$service")
    if [[ " ${SERVICES_TO_KEEP[*]} " =~ " ${service_name} " ]]; then
        echo "✅ Keeping service: $service_name"
    else
        echo "🗑️ Removing service: $service_name"
        rm -rf "$service"
    fi
done

# Keep essential middleware
if [ -f "middleware/assets.js" ]; then
    echo "✅ Keeping middleware: assets.js"
else
    echo "❌ Middleware not found"
fi

# Keep essential database files
DB_FILES_TO_KEEP=("connection.js")

for db_file in database/*/; do
    db_file_name=$(basename "$db_file")
    if [[ " ${DB_FILES_TO_KEEP[*]} " =~ " ${db_file_name} " ]]; then
        echo "✅ Keeping DB file: $db_file_name"
    else
        echo "🗑️ Removing DB file: $db_file_name"
        rm -rf "$db_file"
    fi
done

# Remove old controllers directory if it exists
if [ -d "controllers" ]; then
    echo "🗑️ Removing old controllers directory"
    rm -rf controllers
fi

# Remove old index.js.backup if it exists
if [ -f "index.js.backup" ]; then
    echo "🗑️ Removing backup index.js"
    rm -f index.js.backup
fi

# Show final structure
echo ""
echo "📂 Final server structure:"
ls -la

echo ""
echo "✅ Cleanup completed! Server is now ready for v2.0 with:"
echo "- Enhanced modular structure"
echo "- Only essential files retained"
echo "- Old unnecessary files removed"
