# Development & Execution Guide

## Prerequisites
- Node.js >= 18 (Tested on v22.19.0)
- npm >= 9 (Tested on 10.9.3)
- Expo CLI (`npx expo`)

## Installation

```bash
# Navigate to workspace
cd "d:/Project/NEC Faculty App"

# Install dependencies (already executed)
npm install
```

## Running the Application

### Start Expo Development Server

```bash
npx expo start
```

### Options:
- Press `a` to open on Android Emulator or connected device.
- Press `i` to open on iOS Simulator.
- Press `w` to open on Web Browser preview.
- Scan the displayed QR code with the **Expo Go** mobile app on iOS or Android.

## Verification Commands

To verify static code syntax and module dependencies:

```bash
# Check expo doctor / health
npx expo-doctor

# Start Expo in non-interactive verification mode
npx expo start --offline
```

## Technology Stack Compliance
- **Framework**: React Native 0.86.3 with Expo SDK 57
- **Router**: Expo Router v57
- **Language**: Pure JavaScript (ES6+ / JSX) — **Zero TypeScript files**
- **Styling**: React Native `StyleSheet` — **Zero Tailwind / Web CSS files**
- **Architecture**: Single unified `TimetableSession` demo dataset powering all views
