# 🚀 Chaos Coordinator

Cross-functional project management platform with role-based workflows and intelligent automation.

## 🎯 **Quick Start**

### **Prerequisites**
- Node.js 16+
- SQLite (included)

### **Start the Application**

#### **Step 1: Start Backend**
```bash
cd server
node index-working.js
```

#### **Step 2: Start Frontend**
```bash
cd client
npm start
```

#### **Step 3: Access Application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health

---

## 🔐 **Login Credentials**

### **Demo Accounts**
- **Admin**: `admin@chaoscoordinator.com` / `password123`
- **Sales**: `sarah@chaoscoordinator.com` / `password123`
- **PM**: `mike@chaoscoordinator.com` / `password123`
- **CSM**: `lisa@chaoscoordinator.com` / `password123`
- **Product**: `tom@chaoscoordinator.com` / `password123`
- **Demo**: `demo@example.com` / `password123`

---

## 🏗️ **Project Structure**

```
chaos-coordinator/
├── client/                 # React frontend
│   ├── build/              # Built production files
│   ├── public/             # Static assets
│   ├── src/                # Source code
│   └── package.json        # Frontend dependencies
├── server/                 # Node.js backend
│   ├── index-working.js     # Main server file
│   ├── auth-demo.js        # Authentication system
│   └── modules/           # API modules
├── database/              # Database files
│   └── sqlite_schema.sql   # Database schema
├── database.sqlite         # SQLite database
├── knexfile.sqlite.js     # Database configuration
├── package.json           # Root dependencies
└── README.md             # This file
```

---

## 🌟 **Features**

### **✅ Working Features**
- **Authentication System**: Role-based login/logout
- **Dashboard**: Projects, tasks, and users overview
- **API Integration**: Full backend connectivity
- **Database**: SQLite with sample data
- **Role-Based Access**: Different features per role
- **Hot Reload**: Development with instant updates

### **🔄 Ready for Enhancement**
- **Decision Tracking**: Complete decision logging system
- **Responsibility Timeline**: Ownership and accountability tracking
- **Meeting Notes**: Comprehensive meeting management
- **Delay Analytics**: Pattern recognition and prevention
- **Project Intelligence**: Health scoring and automation

---

## 🔧 **Development**

### **Frontend Development**
```bash
cd client
npm install
npm start
```

### **Backend Development**
```bash
cd server
npm install
node index-working.js
```

### **Database Setup**
```bash
sqlite3 database.sqlite < database/sqlite_schema.sql
```

### **Build for Production**
```bash
cd client
npm run build
```

---

## 🌐 **API Endpoints**

### **Authentication**
- `POST /api/login` - User login
- `GET /api/me` - Get current user
- `POST /api/logout` - User logout

### **Data**
- `GET /api/projects` - List all projects
- `GET /api/tasks` - List all tasks
- `GET /api/users` - List all users
- `GET /api/milestones` - List all milestones

### **System**
- `GET /api` - API documentation
- `GET /health` - Health check

---

## 🎯 **Technologies**

### **Frontend**
- React 19 with TypeScript
- Tailwind CSS for styling
- Axios for API calls
- React Router for navigation

### **Backend**
- Node.js with Express
- SQLite for database
- JWT-like authentication
- CORS enabled for development

---

## 📱 **Role-Based Experience**

### **Sales Role**
- Project intake and creation
- Sales pipeline management
- Client handoff workflows

### **Project Manager Role**
- Full project management
- Task assignment and tracking
- Team coordination

### **Customer Success Role**
- Client satisfaction tracking
- Success metrics and reporting
- Customer relationship management

### **Admin Role**
- System administration
- User management
- Configuration control

---

## 🚀 **Development Workflow**

### **Hot Reload**
- Frontend runs on `http://localhost:3000`
- Backend runs on `http://localhost:3001`
- Changes to `client/src/` files reflect instantly
- No manual restart needed

### **Making Changes**
1. Edit any file in `client/src/`
2. Save the file
3. Browser auto-refreshes with changes
4. API calls work seamlessly

---

## 📞 **Support**

For issues and questions:
1. Check the console for errors
2. Verify backend is running on port 3001
3. Verify frontend is running on port 3000
4. Check database connection

---

**🎉 Chaos Coordinator - Streamlining cross-functional project management with intelligent automation!**
