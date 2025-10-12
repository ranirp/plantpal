# 🌱 PlantPal - Plant Sharing Community

A Progressive Web App (PWA) for sharing plants and care tips with your local community. Built with Node.js, Express, MongoDB, Socket.IO, and IndexedDB for full offline functionality.

### Core Features
- 🔐 **User Authentication** - Simple nickname-based login with IndexedDB persistence
- 🌿 **Plant Sharing** - Add plants with photos, types, and care descriptions
- 📱 **Progressive Web App** - Install on mobile/desktop, works offline
- 💬 **Real-Time Chat** - Socket.IO powered chat for each plant
- 📴 **Offline Mode** - Full functionality without internet connection
- 🔄 **Auto Sync** - Automatic synchronization when back online
- 🔍 **Filter & Sort** - Filter by plant type, sort by date/name/type
- 📸 **Image Upload** - Photo upload with preview and compression
- 🎨 **Responsive Design** - Beautiful UI with Tailwind CSS and DaisyUI


## 📦 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v14.0.0 or higher)
   ```bash
   node --version
   ```

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **MongoDB** (Local or Cloud)
   - **Option A:** Local MongoDB installation ([Download](https://www.mongodb.com/try/download/community))
   - **Option B:** MongoDB Atlas free tier ([Sign up](https://www.mongodb.com/cloud/atlas/register))

4. **Git** (optional, for cloning)
   ```bash
   git --version
   ```

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/ranirp/plant-sharing-community.git
cd plant-sharing-community
```

Or download and extract the ZIP file from GitHub.

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`:
- Express, Socket.IO, Mongoose for backend
- Multer for file uploads
- Tailwind CSS, DaisyUI for styling
- Canvas for image processing
- And all other dependencies


## 🏃‍♂️ Running the Project

### Method 1: Development Mode (Recommended)

For development with automatic restarts and CSS watching:

1. **Start Tailwind CSS in watch mode** (Terminal 1):
   ```bash
   npm run tailwind
   ```
   This monitors CSS changes and automatically rebuilds styles.

2. **Start the development server** (Terminal 2):
   ```bash
   npm run dev
   ```
   This starts the server with nodemon for automatic restarts on file changes.

### Method 2: Production Mode

For production deployment:

1. **Build CSS files**:
   ```bash
   npm run build:css
   ```

2. **Start the production server**:
   ```bash
   npm start
   ```

### Access the Application

Once both commands are running:
- Open your browser and navigate to: `http://localhost:3001`
- The app will be available at this address
- For mobile testing, use your computer's IP address: `http://YOUR_IP:3001`


## 🔧 Additional Setup

### MongoDB Setup Options

**Option A: Local MongoDB**
1. Install MongoDB Community Edition
2. Start MongoDB service:
   ```bash
   # macOS (using Homebrew)
   brew services start mongodb-community
   
   # Ubuntu/Debian
   sudo systemctl start mongod
   
   # Windows
   net start MongoDB
   ```

**Option B: MongoDB Atlas (Cloud)**
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a new cluster
3. Add your IP address to the whitelist
4. Create a database user
5. Copy the connection string to your `.env` file

### PWA Installation

The app can be installed as a Progressive Web App:
1. Open the app in your browser
2. Look for the "Install" prompt or use browser menu
3. Add to home screen on mobile devices

### Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-restart |
| `npm run tailwind` | Watch and compile Tailwind CSS |
| `npm run build:css` | Build CSS for production |
| `npm run build:js` | Build JavaScript for production |
| `npm run build` | Build both CSS and JS for production |

## Application UI Design
![Login Page](public/assets/Login.png)

![Homepage](public/assets/Homepage%20-%20empty.png)

![Homepage](public/assets/Homepage.png)

![App Plant Form](public/assets/AddPlantform.png)

![Chat](public/assets/No-chat.png)

![Chat Online](public/assets/Chat-Online.png)

![Chat Offline](public/assets/Chat-Offline.png)

<h3 align="center"> ʘ‿ʘ </h3>



