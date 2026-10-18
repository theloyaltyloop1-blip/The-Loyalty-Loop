module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx vite preview --port 4173 --strictPort',
      startServerReadyPattern: 'Local',
      url: ['/', '/login', '/signup', '/dashboard', '/dashboard/shop/demo', '/owner', '/terms'].map((p) => `http://localhost:4173${p}`),
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 300000 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '../../audit-reports/lhci-final' },
  },
}
