/**
 * Settings Page
 * Application settings and preferences
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/Card';
import { Button } from '../components/Button';

export function Settings() {
  const [settings, setSettings] = useState({
    apiKey: '',
    defaultPortfolio: '100000',
    riskLevel: 'moderate',
    notifications: true,
    autoRefresh: true,
    refreshInterval: '5',
  });

  const handleSave = () => {
    // In a real app, this would save to backend
    alert('Settings saved!');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* API Configuration */}
      <Card>
        <CardHeader title="API Configuration" subtitle="Connect to external services" />
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">
              API Key (Optional)
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) =>
                setSettings({ ...settings, apiKey: e.target.value })
              }
              placeholder="Enter API key for live data..."
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text-muted mt-1">
              Optional: Connect to live market data providers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trading Preferences */}
      <Card>
        <CardHeader title="Trading Preferences" subtitle="Default trading settings" />
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">
              Default Portfolio Size
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                type="number"
                value={settings.defaultPortfolio}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPortfolio: e.target.value })
                }
                className="w-full pl-8 pr-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Risk Level</label>
            <select
              value={settings.riskLevel}
              onChange={(e) =>
                setSettings({ ...settings, riskLevel: e.target.value })
              }
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
            <p className="text-xs text-text-muted mt-1">
              Affects position sizing and risk limits
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader title="Display Settings" subtitle="Customize the interface" />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text">Notifications</p>
              <p className="text-xs text-text-muted">
                Receive alerts for signals and orders
              </p>
            </div>
            <button
              onClick={() =>
                setSettings({ ...settings, notifications: !settings.notifications })
              }
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.notifications ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-text">Auto-Refresh Data</p>
              <p className="text-xs text-text-muted">
                Automatically update market data
              </p>
            </div>
            <button
              onClick={() =>
                setSettings({ ...settings, autoRefresh: !settings.autoRefresh })
              }
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.autoRefresh ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {settings.autoRefresh && (
            <div>
              <label className="block text-sm text-text-muted mb-1">
                Refresh Interval (seconds)
              </label>
              <input
                type="number"
                value={settings.refreshInterval}
                onChange={(e) =>
                  setSettings({ ...settings, refreshInterval: e.target.value })
                }
                min="1"
                max="60"
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Settings</Button>
      </div>

      {/* About */}
      <Card>
        <CardHeader title="About MaxTrade" />
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-text">
              <strong>Version:</strong> 1.0.0
            </p>
            <p className="text-text">
              <strong>Build:</strong> {new Date().toISOString().slice(0, 10)}
            </p>
            <p className="text-text-muted mt-4">
              MaxTrade is an AI-powered quantitative trading platform for paper
              trading and strategy development.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
