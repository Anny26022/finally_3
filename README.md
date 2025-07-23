# 📈 Nexus - Advanced Trading Journal & Portfolio Analytics Platform

[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0.11-646CFF.svg)](https://vitejs.dev/)
[![HeroUI](https://img.shields.io/badge/HeroUI-2.7.8-purple.svg)](https://heroui.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud%20Sync-green.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **The most comprehensive, feature-rich trading journal and portfolio analytics platform built with modern React, TypeScript, and cloud-first architecture. Designed for serious traders who demand precision, flexibility, real-time cloud synchronization, and deep insights into their trading performance.**

## 🌟 **Key Highlights**

- **☁️ Cloud-First Architecture**: Full Supabase integration with real-time sync across devices
- **🔐 Secure Authentication**: Email/password, OAuth (Google, Twitter), and secure user management
- **📊 Advanced Chart Management**: Upload, store, and manage trading charts with cloud storage
- **🎯 Dual Accounting Methods**: Support for both Cash Basis and Accrual Basis accounting
- **📈 Advanced Analytics**: Deep performance metrics, risk analysis, and portfolio insights
- **🔄 Real-time Calculations**: Live P/L tracking, position sizing, and risk metrics
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **🎨 Modern UI/UX**: Sleek, intuitive interface with smooth animations
- **💾 Hybrid Storage**: Cloud-first with local backup for offline access
- **🔧 Highly Customizable**: Flexible configuration and personalization options

---

## 🚀 **Quick Start**

### Prerequisites
- **Node.js** 18.0+
- **npm** or **yarn** package manager
- **Supabase Account** (for cloud sync features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/nexus-trading-journal.git
cd nexus-trading-journal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Setup

Create a `.env.local` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### First Launch
1. Open your browser to `http://localhost:5173`
2. **Sign up** for a new account or **sign in** with existing credentials
3. Complete the **initial portfolio setup** wizard
4. Configure your **accounting method preference**
5. Set up **True Portfolio System** with starting capital
6. Start adding your trades and uploading charts!

---

## 🎯 **Core Features**

### ☁️ **Cloud-First Architecture & Authentication**
- **Secure User Authentication**: Email/password, OAuth providers (Google, Twitter)
- **Real-time Cloud Sync**: All data synchronized across devices via Supabase
- **Offline-First Design**: Local storage backup with automatic cloud sync when online
- **Multi-Device Access**: Seamless experience across desktop, tablet, and mobile
- **Data Security**: Row-level security (RLS) ensuring users only access their own data
- **Session Management**: Automatic token refresh and secure session handling
- **Email Verification**: Secure account verification and password reset flows

### 📊 **Advanced Chart Management System**
- **Chart Upload & Storage**: Upload trading charts with cloud storage via Supabase
- **Multiple Upload Methods**:
  - **File Upload**: Drag & drop or click to upload PNG, JPG, WebP files
  - **TradingView URL**: Direct import from TradingView chart links
- **Intelligent Chart Processing**: Automatic compression and optimization
- **Before/After Documentation**: Upload charts for trade entry and exit points
- **Temporary Chart Storage**: Upload charts before trade exists, auto-save when trade is created
- **Chart Viewer**: Full-screen chart viewing with zoom and pan capabilities
- **Universal Chart Browser**: Browse all charts across trades with advanced filtering
- **Cloud Storage Management**: Efficient binary data storage with metadata indexing

### 📝 **Comprehensive Trade Journal Management**
- **Advanced Trade Tracking**: Record entry/exit prices, quantities, dates, and strategies
- **Multi-Level Position Building**: Support for pyramid entries (up to 2 levels) and partial exits (up to 3 levels)
- **Real-time Calculations**: Auto-calculated metrics including position size, allocation, reward:risk ratios
- **Inline Editing**: Quick edit capabilities directly in the trade table
- **Chart Integration**: Attach before/after charts to every trade
- **Advanced Filtering**: Filter by status, date ranges, symbols, setups, and custom criteria
- **Bulk Operations**: Import/export trades via CSV/Excel formats
- **Trade Validation**: Comprehensive validation with warnings and error checking

### 📈 **Advanced Analytics Dashboard**
- **Performance Metrics**: Sharpe ratio, Sortino ratio, Calmar ratio, and custom risk metrics
- **Portfolio Analytics**: True portfolio tracking with capital changes and monthly performance
- **Trade Statistics**: Win rate, average win/loss, consecutive wins/losses, and more
- **Sector Analysis**: Performance breakdown by industry sectors
- **Risk Management**: Drawdown analysis, position sizing insights, and risk exposure metrics
- **Drawdown Curve Analysis**: Advanced drawdown visualization with volatility toggle and reset indicators
- **Interactive Charts**: Responsive charts with real-time data visualization
- **Custom Date Ranges**: Global filtering with custom date range selection
- **Export Capabilities**: Export analytics data to Excel and CSV formats

### 💰 **Dual Accounting System**
- **Cash Basis Accounting**: P/L attributed to exit dates (when trades are closed)
- **Accrual Basis Accounting**: P/L attributed to entry dates (when trades are initiated)
- **Real-time Switching**: Toggle between methods with instant recalculation
- **Consistent Application**: All analytics, charts, and reports respect the selected method
- **Tax Reporting**: Optimized reporting for different accounting requirements
- **Historical Accuracy**: Maintains data integrity across accounting method changes

### 🏦 **True Portfolio Management System**
- **Accurate Portfolio Tracking**: True portfolio size calculation with deposits/withdrawals
- **Capital Changes Management**: Track deposits, withdrawals, and their impact
- **Monthly Performance**: Detailed month-by-month portfolio performance analysis
- **Yearly Starting Capital**: Set and manage starting capital for each year
- **Historical Tracking**: Maintain complete history of portfolio changes and performance
- **Real-time Updates**: Portfolio size updates automatically with new trades
- **Override Capabilities**: Manual override for specific months when needed

### 🎖️ **Achievement & Milestone System** *(REMOVED)*
- **Note**: Milestone functionality has been completely removed from the application to improve performance and simplify the codebase.

---

## 🛠️ **Technology Stack**

### **Frontend Framework**
- **React 18.3.1** - Modern React with hooks and concurrent features
- **TypeScript 5.7.3** - Type-safe development with advanced type checking
- **Vite 6.0.11** - Lightning-fast build tool and development server

### **Cloud Infrastructure**
- **Supabase** - Backend-as-a-Service with PostgreSQL database
- **Supabase Auth** - Secure authentication with JWT tokens
- **Supabase Storage** - Binary file storage for chart images
- **Row Level Security (RLS)** - Database-level security policies
- **Real-time Subscriptions** - Live data synchronization

### **UI/UX Libraries**
- **HeroUI 2.7.8** - Modern, accessible component library
- **Framer Motion 11.18.2** - Smooth animations and transitions
- **Iconify React** - Comprehensive icon library
- **Tailwind CSS 3.4.17** - Utility-first CSS framework

### **Data Visualization**
- **Recharts 2.15.3** - Responsive charts and graphs
- **Nivo Charts 0.99.0** - Advanced data visualization components
- **React Calendar Heatmap** - Trading activity heatmaps

### **Data Management**
- **React Router DOM 5.3.4** - Client-side routing
- **Date-fns 4.1.0** - Modern date utility library
- **PapaParse 5.5.3** - CSV parsing and generation
- **XLSX 0.18.5** - Excel file handling

### **Storage & Sync**
- **Supabase PostgreSQL** - Primary cloud database
- **IndexedDB** - Local browser storage for offline access
- **Hybrid Storage Strategy** - Cloud-first with local backup

---

## 📁 **Project Structure**

```
src/
├── components/           # Reusable UI components
│   ├── analytics/       # Analytics-specific components
│   │   ├── drawdown-curve.tsx  # Advanced drawdown analysis component
│   │   ├── performance-chart.tsx # Portfolio performance charts
│   │   ├── performance-metrics.tsx # Risk and performance metrics
│   │   └── trade-statistics.tsx # Trade statistics component
│   ├── dashboard/       # Dashboard widgets
│   ├── tax/            # Tax analytics components
│   ├── trade-table/    # Trade table components
│   ├── auth/           # Authentication components
│   ├── ChartImageUpload.tsx    # Chart upload component
│   ├── ChartImageViewer.tsx    # Chart viewing component
│   ├── UniversalChartViewer.tsx # Chart browser component
│   └── icons/          # Custom icon components
├── context/             # React context providers
│   ├── AccountingMethodContext.tsx
│   ├── GlobalFilterContext.tsx
│   ├── AuthContext.tsx  # Authentication context
│   └── TruePortfolioContext.tsx
├── hooks/               # Custom React hooks
│   ├── use-trades.ts
│   ├── use-milestones.ts
│   ├── use-capital-changes.ts
│   ├── use-true-portfolio-with-trades.ts
│   └── use-dashboard-config.ts
├── services/            # Service layer
│   ├── supabaseService.ts      # Supabase integration
│   ├── authService.ts          # Authentication service
│   ├── chartImageService.ts    # Chart management service
│   └── databaseService.ts      # Local database service
├── pages/               # Page components
│   ├── DeepAnalyticsPage.tsx
│   ├── monthly-performance.tsx
│   └── auth/           # Authentication pages
├── types/               # TypeScript type definitions
│   ├── trade.ts        # Trade-related types
│   ├── auth.ts         # Authentication types
│   └── database.ts     # Database schema types
├── utils/               # Utility functions and helpers
│   ├── tradeCalculations.ts
│   ├── accountingUtils.ts
│   ├── chartImageUtils.ts
│   ├── temporaryChartStorage.ts
│   └── dateFilterUtils.ts
├── lib/                 # External library configurations
│   └── supabase.ts     # Supabase client configuration
└── data/                # Constants and mock data
```

---

## ⚙️ **Configuration & Customization**

### **Cloud Sync Setup**
Configure your Supabase integration:
- **Environment Variables**: Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- **Authentication Providers**: Enable OAuth providers (Google, Twitter)
- **Database Policies**: Row Level Security automatically configured
- **Storage Buckets**: Chart image storage automatically managed

### **Authentication Configuration**
Set up secure user authentication:
- **Email/Password**: Standard email-based authentication
- **OAuth Providers**: Social login with Google and Twitter
- **Email Verification**: Secure account verification flow
- **Password Reset**: Self-service password reset functionality
- **Session Management**: Automatic token refresh and secure sessions

### **Accounting Method Setup**
Configure your preferred accounting method in the Profile Settings:
- **Cash Basis**: P/L appears on exit dates (recommended for tax reporting)
- **Accrual Basis**: P/L appears on entry dates (recommended for performance analysis)
- **Real-time Switching**: Change methods anytime with instant recalculation
- **Historical Consistency**: All data remains consistent across method changes

### **True Portfolio Configuration**
Set up your portfolio parameters:
- **Yearly Starting Capital**: Set starting capital for each year
- **Monthly Overrides**: Override starting capital for specific months
- **Capital Changes**: Track deposits and withdrawals by month
- **Automatic Calculations**: Portfolio size updates automatically
- **Historical Data**: Add data for previous years

### **Chart Management Settings**
Configure chart upload and storage:
- **Upload Methods**: Enable file upload and/or TradingView URL import
- **Compression Settings**: Automatic image optimization
- **Storage Limits**: Monitor cloud storage usage
- **Temporary Storage**: Charts uploaded before trade creation

### **Dashboard Customization**
Personalize your dashboard:
- **Widget Visibility**: Toggle dashboard widgets on/off
- **Custom Date Ranges**: Set global date filters
- **Performance Metrics**: Configure displayed metrics
- **Chart Preferences**: Customize chart colors and styles
- **Export Settings**: Configure default export formats

---

## 📊 **Key Metrics & Calculations**

### **Performance Metrics**
- **Sharpe Ratio**: Risk-adjusted returns calculation
- **Sortino Ratio**: Downside deviation-based risk metric
- **Calmar Ratio**: Return vs maximum drawdown
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Gross profit vs gross loss ratio
- **Average R-Multiple**: Risk-reward performance measurement
- **Consecutive Wins/Losses**: Streak analysis
- **Plan Followed Rate**: Trading discipline measurement

### **Risk Metrics**
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Value at Risk (VaR)**: Potential loss estimation
- **Position Sizing**: Kelly criterion and fixed percentage methods
- **Risk-Reward Ratios**: Expected vs actual R-multiples
- **Heat Mapping**: Position concentration analysis
- **Correlation Analysis**: Portfolio diversification metrics

### **Portfolio Metrics**
- **True Portfolio Size**: Accurate portfolio value with capital changes
- **Monthly Returns**: Period-over-period performance
- **Cumulative Returns**: Total portfolio growth
- **Allocation Analysis**: Position sizing and diversification metrics
- **Cash Utilization**: Percentage of capital deployed
- **Portfolio Impact**: Individual trade impact on total portfolio

### **Chart Analytics**
- **Chart Attachment Rate**: Percentage of trades with charts
- **Storage Usage**: Cloud storage consumption tracking
- **Chart Quality Metrics**: Image compression and optimization stats
- **Upload Success Rate**: Chart upload reliability metrics

---

## 🔧 **Advanced Features**

### **Cloud Synchronization**
- **Real-time Sync**: Instant data synchronization across all devices
- **Conflict Resolution**: Automatic handling of concurrent edits
- **Offline Support**: Local storage with automatic sync when online
- **Data Migration**: Seamless migration from local to cloud storage
- **Backup & Restore**: Complete cloud backup and restoration
- **Multi-Device Access**: Access your data from anywhere

### **Chart Management System**
- **Multiple Upload Methods**: File upload and TradingView URL import
- **Intelligent Processing**: Automatic image compression and optimization
- **Temporary Storage**: Upload charts before trade creation
- **Universal Chart Viewer**: Browse all charts with advanced filtering
- **Full-Screen Viewing**: Zoom and pan capabilities for detailed analysis
- **Cloud Storage**: Secure binary storage with metadata indexing
- **Batch Operations**: Upload multiple charts efficiently

### **Data Import/Export**
- **CSV Import**: Bulk import trades from CSV files with validation
- **Excel Export**: Export filtered data to Excel format with formatting
- **Cloud Backup**: Automatic cloud backup of all data
- **Data Migration**: Import from other trading journal platforms
- **Template Downloads**: Pre-formatted import templates
- **Selective Export**: Export specific date ranges or filtered data

### **Real-time Price Integration**
- **Live Price Updates**: Automatic CMP (Current Market Price) updates
- **Smart Price Fetching**: Historical fallback during off-market hours
- **Price History**: Historical price data integration
- **Market Data API**: Configurable price data sources
- **Auto-Fill**: Automatic price population for new trades

### **Advanced Filtering & Search**
- **Global Date Filters**: Application-wide date range filtering
- **Multi-Criteria Search**: Search by symbol, setup, status, and more
- **Custom Views**: Save and restore custom filter configurations
- **Quick Filters**: One-click common filter presets
- **Chart Filtering**: Filter trades by chart attachment status
- **Performance Filters**: Filter by win/loss, R-multiples, and more

---

## 🎨 **UI/UX Features**

### **Modern Interface Design**
- **Sleek Aesthetics**: Clean, professional interface with smooth animations
- **Intuitive Navigation**: Easy-to-use navigation with clear visual hierarchy
- **Contextual Actions**: Smart action buttons and contextual menus
- **Visual Feedback**: Loading states, progress indicators, and status updates
- **Consistent Design**: Unified design language across all components

### **Responsive Design**
- **Mobile Optimized**: Full functionality on mobile devices with touch-friendly interface
- **Tablet Support**: Optimized layouts for tablet screens with gesture support
- **Desktop Experience**: Rich desktop interface with advanced features and shortcuts
- **Adaptive Layouts**: Dynamic layouts that adapt to screen size and orientation
- **Cross-Platform**: Consistent experience across all platforms and browsers

### **Accessibility**
- **Keyboard Navigation**: Full keyboard accessibility with logical tab order
- **Screen Reader Support**: ARIA labels and semantic HTML for assistive technologies
- **High Contrast**: Support for high contrast themes and color accessibility
- **Font Scaling**: Responsive typography and scaling for visual impairments
- **Focus Management**: Clear focus indicators and logical focus flow

### **Theming & Customization**
- **Dark/Light Mode**: Automatic and manual theme switching with system preference detection
- **Custom Color Schemes**: Configurable color schemes for personal preference
- **Animation Controls**: Customizable animation preferences and reduced motion support
- **Layout Options**: Flexible layout options for different workflow preferences
- **Personalization**: Save and restore personal UI preferences

---

## 🚀 **Performance Optimizations**

### **Rendering Optimizations**
- **React.memo**: Optimized component re-rendering with intelligent memoization
- **useMemo/useCallback**: Memoized calculations and functions for expensive operations
- **Virtual Scrolling**: Efficient handling of large datasets with virtualized lists
- **Lazy Loading**: On-demand component loading with React.lazy and Suspense
- **Code Splitting**: Dynamic imports for optimal bundle sizes
- **Image Optimization**: Automatic image compression and lazy loading

### **Data Management**
- **Hybrid Storage**: Cloud-first with local backup for optimal performance
- **Intelligent Caching**: Smart caching strategies for frequently accessed data
- **Debounced Updates**: Optimized user input handling to reduce API calls
- **Batch Operations**: Efficient bulk data operations for imports and exports
- **Memory Management**: Optimized memory usage patterns and garbage collection
- **Connection Pooling**: Efficient database connection management

### **Cloud Sync Optimizations**
- **Delta Sync**: Only sync changed data to minimize bandwidth usage
- **Compression**: Data compression for faster sync and reduced storage
- **Offline Queue**: Queue operations when offline and sync when reconnected
- **Conflict Resolution**: Intelligent conflict resolution for concurrent edits
- **Background Sync**: Non-blocking background synchronization

---

## 📈 **Analytics Capabilities**

### **Comprehensive Trade Analysis**
- **Performance Attribution**: Identify top-performing strategies and setups
- **Sector Analysis**: Performance breakdown by industry and market sectors
- **Time-based Analysis**: Performance by time periods, days of week, and market sessions
- **Strategy Effectiveness**: Compare different trading approaches and methodologies
- **Setup Analysis**: Detailed analysis of trade setups and their success rates
- **Chart Pattern Recognition**: Analysis of chart patterns and their outcomes

### **Advanced Risk Analysis**
- **Drawdown Analysis**: Detailed drawdown periods, recovery times, and underwater curves
- **Drawdown Curve Visualization**: Interactive drawdown charts with peak reset indicators
- **Volatility Analysis**: Rolling volatility metrics with dual-view toggle functionality
- **Correlation Analysis**: Position correlation and portfolio diversification metrics
- **Volatility Metrics**: Risk-adjusted performance measures and volatility analysis
- **Stress Testing**: Portfolio performance under various market scenarios
- **Position Sizing Analysis**: Optimal position sizing and risk management insights
- **Heat Mapping**: Visual representation of risk concentration and exposure

### **Portfolio Analytics**
- **True Portfolio Tracking**: Accurate portfolio performance with capital changes
- **Monthly Performance**: Detailed month-by-month analysis with attribution
- **Cumulative Performance**: Long-term portfolio growth and compound returns
- **Benchmark Comparison**: Compare performance against market indices
- **Capital Efficiency**: Analysis of capital utilization and deployment
- **Risk-Adjusted Returns**: Sharpe, Sortino, and Calmar ratios

### **Chart Analytics**
- **Chart Attachment Analysis**: Track chart documentation completeness
- **Visual Trade Documentation**: Before/after chart comparison and analysis
- **Chart Quality Metrics**: Image quality and compression statistics
- **Storage Analytics**: Cloud storage usage and optimization insights

### **Comprehensive Reporting**
- **Monthly Reports**: Comprehensive monthly performance summaries with charts
- **Tax Reports**: Tax-optimized reporting with dual accounting method support
- **Custom Reports**: Configurable report generation with custom date ranges
- **Export Options**: Multiple export formats (PDF, Excel, CSV) for external analysis
- **Automated Reports**: Scheduled report generation and email delivery
- **Interactive Dashboards**: Real-time interactive analytics dashboards

---

## 🔒 **Data Privacy & Security**

### **Enterprise-Grade Security**
- **Row Level Security (RLS)**: Database-level security ensuring users only access their own data
- **JWT Authentication**: Secure token-based authentication with automatic refresh
- **Encrypted Storage**: All data encrypted at rest and in transit
- **OAuth Integration**: Secure social login with Google and Twitter
- **Session Management**: Secure session handling with automatic timeout
- **API Security**: Rate limiting and request validation

### **Cloud-First Privacy**
- **User Data Isolation**: Complete data isolation between users
- **GDPR Compliance**: Full compliance with data protection regulations
- **Data Portability**: Easy data export and migration capabilities
- **Right to Deletion**: Complete data deletion on account termination
- **Audit Trails**: Comprehensive logging of all data access and modifications
- **Backup Security**: Encrypted backups with secure key management

### **Hybrid Storage Benefits**
- **Local Backup**: Local storage backup for offline access and redundancy
- **Cloud Sync**: Real-time cloud synchronization for multi-device access
- **Data Redundancy**: Multiple layers of data protection and backup
- **Offline Capability**: Full functionality even when offline
- **Sync Conflict Resolution**: Intelligent handling of data conflicts

### **Data Integrity & Validation**
- **Comprehensive Validation**: Multi-layer data validation and error checking
- **Consistency Checks**: Automatic data consistency maintenance across all components
- **Recovery Mechanisms**: Built-in data recovery and corruption detection
- **Version Control**: Data format versioning for future compatibility
- **Transaction Safety**: Atomic operations ensuring data consistency

---

## 📚 **Detailed Feature Documentation**

### **Chart Management System**

#### **Upload Methods**
1. **File Upload**
   - Drag & drop interface for PNG, JPG, WebP files
   - Click to browse and select files
   - Automatic file validation and size checking
   - Real-time upload progress indicators

2. **TradingView URL Import**
   - Direct import from TradingView chart links
   - Automatic snapshot ID extraction
   - Support for multiple TradingView URL formats
   - Intelligent URL parsing and validation

#### **Chart Processing**
- **Automatic Compression**: Intelligent image compression without quality loss
- **Format Optimization**: Automatic format conversion for optimal storage
- **Metadata Extraction**: Capture and store image metadata
- **Quality Validation**: Ensure chart images meet quality standards

#### **Storage & Sync**
- **Cloud Storage**: Secure binary storage in Supabase
- **Temporary Storage**: Upload charts before trade creation
- **Automatic Sync**: Real-time synchronization across devices
- **Offline Support**: Local storage with automatic cloud sync

#### **Chart Viewing**
- **Universal Chart Viewer**: Browse all charts with advanced filtering
- **Full-Screen Mode**: Detailed chart analysis with zoom and pan
- **Before/After Comparison**: Side-by-side chart comparison
- **Chart Metadata**: View upload date, file size, and compression info

### **Drawdown Curve Analysis**

#### **Advanced Risk Visualization**
- **Dual-View Toggle**: Switch between drawdown and volatility analysis with smooth animations
- **Cumulative Profit Factor**: Track cumulative portfolio performance over time
- **DD From Peak Calculation**: Absolute percentage points down from portfolio highs
- **New Peak Indicators**: Visual markers showing when drawdown resets to zero

#### **Interactive Features**
- **Drawdown View**: Red area chart showing portfolio drawdown depth over time
- **Volatility View**: Orange line chart displaying rolling 3-month volatility
- **Peak Reset Markers**: Green dots and crown icons indicating new portfolio highs
- **Enhanced Tooltips**: Detailed metrics on hover with recovery and peak information

#### **Summary Statistics**
- **Max Drawdown**: Worst drawdown percentage experienced
- **Current Drawdown**: Current distance from portfolio peak
- **Average Volatility**: Rolling volatility average for risk assessment
- **New Peaks Count**: Number of times portfolio reached new highs

#### **Detailed Modal Analysis**
- **Enhanced Chart View**: Larger, more detailed drawdown visualization
- **Comprehensive Table**: Complete breakdown of monthly performance data
- **Row Highlighting**: Visual indicators for new peak periods
- **Export Ready**: Prepared for future export functionality

#### **Risk Insights**
- **Recovery Patterns**: Understand how quickly you recover from drawdowns
- **Peak Frequency**: Analyze how often you reach new portfolio highs
- **Volatility Trends**: Identify periods of high and low market volatility
- **Risk Management**: Use drawdown data to optimize position sizing

### **True Portfolio System**

#### **Capital Management**
- **Yearly Starting Capital**: Set starting capital for each year
- **Monthly Overrides**: Override starting capital for specific months
- **Capital Changes**: Track deposits and withdrawals by month
- **Automatic Calculations**: Portfolio size updates with every trade

#### **Performance Tracking**
- **Monthly Performance**: Detailed month-by-month analysis
- **Capital Flow**: Track money in/out of the portfolio
- **True Returns**: Accurate return calculations considering capital changes
- **Historical Data**: Maintain complete portfolio history

### **Authentication System**

#### **Sign-Up Process**
1. Email and password registration
2. Email verification requirement
3. Profile setup with optional first/last name
4. Automatic portfolio initialization

#### **Sign-In Options**
- **Email/Password**: Standard authentication
- **Google OAuth**: One-click Google sign-in
- **Twitter OAuth**: Social media authentication

#### **Security Features**
- **JWT Tokens**: Secure token-based authentication
- **Automatic Refresh**: Seamless token renewal
- **Session Management**: Secure session handling
- **Password Reset**: Self-service password reset

---

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### **Development Setup**
```bash
# Fork and clone the repository
git clone https://github.com/your-username/nexus-trading-journal.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### **Supabase Setup for Development**
1. Create a new Supabase project
2. Run the database migrations (SQL files in `/supabase` folder)
3. Configure Row Level Security policies
4. Set up authentication providers
5. Configure storage buckets for chart images

---

## 🚀 **Deployment & Production**

### **Environment Variables**
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Custom Configuration
VITE_APP_NAME=Nexus Trading Journal
VITE_APP_VERSION=1.0.0
```

### **Production Deployment**
1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Deploy to Hosting Platform**
   - **Vercel**: Automatic deployment with Git integration
   - **Netlify**: Static site hosting with form handling
   - **AWS S3 + CloudFront**: Scalable cloud hosting
   - **Firebase Hosting**: Google's hosting platform

3. **Configure Supabase**
   - Set up production database
   - Configure authentication providers
   - Set up storage buckets
   - Configure Row Level Security policies

### **Performance Monitoring**
- **Real User Monitoring**: Track actual user performance
- **Error Tracking**: Monitor and track application errors
- **Analytics**: User behavior and feature usage analytics
- **Performance Metrics**: Core Web Vitals and loading times

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Supabase Team** - For the excellent Backend-as-a-Service platform
- **HeroUI Team** - For the beautiful and accessible component library
- **React Team** - For the amazing React framework and ecosystem
- **TypeScript Team** - For type-safe development and excellent tooling
- **Vite Team** - For the lightning-fast build tool and development experience
- **Trading Community** - For valuable feedback, feature requests, and testing

---

## 📞 **Support & Contact**

### **Documentation**
- **Technical Architecture**: [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- **Chart Attachments**: [CHART_ATTACHMENTS.md](docs/CHART_ATTACHMENTS.md)
- **True Portfolio System**: [TRUE_PORTFOLIO_SYSTEM.md](TRUE_PORTFOLIO_SYSTEM.md)
- **Setup Instructions**: [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

### **Community & Support**
- **Issues**: [GitHub Issues](https://github.com/your-username/nexus-trading-journal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/nexus-trading-journal/discussions)
- **Feature Requests**: [GitHub Issues](https://github.com/your-username/nexus-trading-journal/issues/new?template=feature_request.md)
- **Bug Reports**: [GitHub Issues](https://github.com/your-username/nexus-trading-journal/issues/new?template=bug_report.md)

### **Roadmap & Future Features**
- **Real-time Market Data**: Live price feeds and market data integration
- **Advanced Charting**: Built-in charting tools and technical analysis
- **Mobile App**: Native mobile applications for iOS and Android
- **API Integration**: RESTful API for third-party integrations
- **Advanced Analytics**: Machine learning-powered trade analysis
- **Social Features**: Community sharing and collaboration tools

---

**Built with ❤️ for traders, by traders.**

*Nexus Trading Journal - Where precision meets performance in trading analytics.*
