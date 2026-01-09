# UI Architecture Documentation

## 📁 Structure Overview

This React application follows a clean, modular architecture with clear separation of concerns:

```
src/
├── main.tsx                 # Bootstrap entry point (~10 lines)
├── App.tsx                  # React Router setup (~20 lines)
├── types/
│   └── index.ts            # All TypeScript type definitions
├── utils/
│   ├── api.ts              # API helper functions (fetchJSON, postFormJSON)
│   ├── formatters.ts       # Formatting utilities (formatDuration, formatBytes)
│   └── sse.ts              # SSE connection handling
├── hooks/
│   ├── useWorkspaceData.ts # Workspace data fetching and state
│   ├── useJobManager.ts    # Job SSE connection management
│   └── useTimelinePlayer.ts # Timeline playback logic
├── pages/
│   ├── WorkspaceListPage.tsx    # Workspace list view (~180 lines)
│   └── WorkspaceViewPage.tsx    # Workspace detail view (~470 lines)
└── components/
    ├── workspace/
    │   ├── WorkspaceCard.tsx         # Individual workspace card
    │   ├── CreateWorkspaceModal.tsx  # Workspace creation modal
    │   └── UploadVideoModal.tsx      # Video upload modal
    ├── map/
    │   ├── MapCard.tsx               # GPS track map display
    │   └── KMLNodeInfoCard.tsx       # Current position details
    ├── timeline/
    │   └── TimelineSection.tsx       # Timeline with controls
    ├── video/
    │   ├── VideoCard.tsx             # Individual video item
    │   ├── VideoList.tsx             # Video grid display
    │   └── VideoPlayerCard.tsx       # Video player component
    └── jobs/
        └── JobsCard.tsx              # Active jobs display
```

## 🔗 Routing

The application uses `react-router-dom` for URL-based navigation:

### Routes
- **`/`** - Redirects to `/workspaces`
- **`/workspaces`** - List all available workspaces
- **`/workspaces/:projectName`** - View and manage a specific workspace

### Navigation
- Use `useNavigate()` hook for programmatic navigation
- Use `useParams()` to access URL parameters
- All routes are defined in `App.tsx`

## 🎯 Design Principles

### 1. **Single Responsibility**
- Each file has a single, clear purpose
- Maximum file size: ~500 lines (most are much smaller)
- Components are focused and composable

### 2. **Separation of Concerns**
- **Types**: Centralized in `types/index.ts`
- **Utils**: Pure functions for API, formatting, SSE
- **Hooks**: Reusable stateful logic
- **Components**: Presentational UI components
- **Pages**: Composition of components with page-level logic

### 3. **Reusability**
- Custom hooks extract complex logic
- Components are self-contained
- Utilities are pure and testable

## 🔧 Key Components

### Custom Hooks

#### `useWorkspaceData`
Manages workspace metadata fetching and state.
```typescript
const { meta, loading, error, setError, loadMeta } = useWorkspaceData(projectName);
```

#### `useJobManager`
Handles SSE connections for job progress tracking.
```typescript
const { jobStates, lastJobActivity, attachJobSSE } = useJobManager(onJobComplete);
```

#### `useTimelinePlayer`
Manages timeline playback, position calculation, and controls.
```typescript
const {
  currentTime,
  setCurrentTime,
  playing,
  setPlaying,
  currentPosition,
  handleStepMouseDown,
  handleStepMouseUp
} = useTimelinePlayer(kmlSummary);
```

### Pages

#### `WorkspaceListPage`
- Lists all workspaces
- Create new workspace modal
- Delete confirmation
- ~180 lines

#### `WorkspaceViewPage`
- Main workspace interface
- Orchestrates all components
- Handles video operations
- ~470 lines

### Component Categories

#### Workspace Components
- **WorkspaceCard**: Display workspace summary with actions
- **CreateWorkspaceModal**: Form to create new workspace
- **UploadVideoModal**: Video file upload interface

#### Map Components
- **MapCard**: GPS track visualization
- **KMLNodeInfoCard**: Current position data display

#### Timeline Components
- **TimelineSection**: Timeline with play controls and video timeline

#### Video Components
- **VideoCard**: Individual video with encode/download actions
- **VideoList**: Grid of all videos
- **VideoPlayerCard**: Video playback component

#### Job Components
- **JobsCard**: Active job progress display (collapsible)

## 🔄 Data Flow

```
main.tsx
  └─> App.tsx (routing)
       ├─> WorkspaceListPage
       │    ├─> WorkspaceCard (multiple)
       │    └─> CreateWorkspaceModal
       │
       └─> WorkspaceViewPage
            ├─> useWorkspaceData (hook)
            ├─> useJobManager (hook)
            ├─> useTimelinePlayer (hook)
            ├─> MapCard
            ├─> KMLNodeInfoCard
            ├─> TimelineSection
            ├─> VideoPlayerCard
            ├─> JobsCard
            └─> VideoList
                 └─> VideoCard (multiple)
```

## 📦 State Management

### Local State
Each component manages its own UI state (modals, forms, etc.)

### Shared State via Hooks
- `useWorkspaceData`: Workspace metadata
- `useJobManager`: Job states and SSE connections
- `useTimelinePlayer`: Timeline position and playback

### Props Drilling
Used sparingly and only when necessary. Most state is kept close to where it's used.

## 🚀 Benefits of This Architecture

1. **Maintainability**: Easy to locate and modify features
2. **Testability**: Small, focused units are easy to test
3. **Scalability**: Clear patterns for adding new features
4. **Developer Experience**: Quick to understand and navigate
5. **Performance**: Minimal re-renders, focused state updates

## 🔍 Migration from Old Code

The original `main.tsx` (~2000 lines) has been refactored into:
- **1 bootstrap file** (`main.tsx`): 11 lines
- **1 app file** (`App.tsx`): 24 lines
- **3 utility files**: ~100 lines total
- **3 custom hooks**: ~340 lines total
- **4 type definitions**: ~85 lines
- **2 pages**: ~650 lines total
- **13 components**: ~800 lines total

**Total**: Same functionality, better organization, easier maintenance!

## 💡 Adding New Features

### To add a new component:
1. Create file in appropriate `components/` subdirectory
2. Import required types from `types/`
3. Use utilities from `utils/` as needed
4. Keep under 500 lines

### To add new page:
1. Create file in `pages/`
2. Add route in `App.tsx`
3. Compose from existing components
4. Extract complex logic to hooks if needed

### To add new hook:
1. Create file in `hooks/`
2. Follow naming convention `use[Feature].ts`
3. Export typed interface
4. Keep focused on single concern

## 🎨 Code Style

- **Functional components** with hooks
- **TypeScript** for type safety
- **Explicit props interfaces** for all components
- **Named exports** for better refactoring
- **Descriptive names** over comments
- **Small functions** over large ones