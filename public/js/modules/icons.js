// アイコンモジュール
window.Icons = {
  Lock: ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
  })),

  MessageCircle: ({ className = 'w-6 h-6 text-blue-400' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
  })),

  Users: ({ className = 'w-16 h-16 mx-auto mb-4 opacity-30' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z'
  })),

  Clock: ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  })),

  Shield: ({ className = 'w-16 h-16 text-blue-400 animate-pulse' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
  })),

  AlertCircle: ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  })),

  Key: ({ className = 'w-4 h-4 text-purple-400' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z'
  })),

  Trash2: ({ className = 'w-3 h-3' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
  }))
};