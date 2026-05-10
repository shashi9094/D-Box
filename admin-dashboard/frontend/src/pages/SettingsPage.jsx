import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button, Input, Card } from '../components/UI';
import { settingsAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings();
      setSettings(response.data?.data || {});
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-600 mt-2">Manage system settings and configurations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <Card>
          <h2 className="text-lg font-bold text-gray-800 mb-4">General Settings</h2>

          <Input
            label="Site Name"
            value={settings.site_name || ''}
            onChange={(e) => handleSettingChange('site_name', e.target.value)}
            placeholder="D-Box Admin"
          />

          <Input
            label="Max Upload Size (Bytes)"
            type="number"
            value={settings.max_upload_size || ''}
            onChange={(e) => handleSettingChange('max_upload_size', e.target.value)}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maintenance Mode
            </label>
            <select
              value={settings.maintenance_mode || 'false'}
              onChange={(e) => handleSettingChange('maintenance_mode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily Backup
            </label>
            <select
              value={settings.daily_backup || 'true'}
              onChange={(e) => handleSettingChange('daily_backup', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </Card>

        {/* SMTP Settings */}
        <Card>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Email Settings (SMTP)</h2>

          <Input
            label="SMTP Host"
            value={settings.smtp_host || ''}
            onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
            placeholder="smtp.gmail.com"
          />

          <Input
            label="SMTP Port"
            type="number"
            value={settings.smtp_port || ''}
            onChange={(e) => handleSettingChange('smtp_port', e.target.value)}
            placeholder="587"
          />

          <Input
            label="SMTP User"
            value={settings.smtp_user || ''}
            onChange={(e) => handleSettingChange('smtp_user', e.target.value)}
          />

          <Input
            label="SMTP Password"
            type="password"
            value={settings.smtp_pass || ''}
            onChange={(e) => handleSettingChange('smtp_pass', e.target.value)}
          />
        </Card>

        {/* AWS Settings */}
        <Card>
          <h2 className="text-lg font-bold text-gray-800 mb-4">AWS S3 Configuration</h2>

          <Input
            label="S3 Bucket Name"
            value={settings.s3_bucket || ''}
            onChange={(e) => handleSettingChange('s3_bucket', e.target.value)}
          />

          <Input
            label="AWS Region"
            value={settings.aws_region || ''}
            onChange={(e) => handleSettingChange('aws_region', e.target.value)}
            placeholder="us-east-1"
          />

          <Input
            label="S3 Endpoint (Optional)"
            value={settings.s3_endpoint || ''}
            onChange={(e) => handleSettingChange('s3_endpoint', e.target.value)}
          />
        </Card>

        {/* Branding */}
        <Card>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Branding</h2>

          <Input
            label="Logo URL"
            value={settings.logo_url || ''}
            onChange={(e) => handleSettingChange('logo_url', e.target.value)}
          />

          <Input
            label="Favicon URL"
            value={settings.favicon_url || ''}
            onChange={(e) => handleSettingChange('favicon_url', e.target.value)}
          />

          <Input
            label="Primary Color"
            type="color"
            value={settings.primary_color || '#0066cc'}
            onChange={(e) => handleSettingChange('primary_color', e.target.value)}
          />

          <Input
            label="Support Email"
            value={settings.support_email || ''}
            onChange={(e) => handleSettingChange('support_email', e.target.value)}
          />
        </Card>
      </div>

      <div className="mt-8 flex gap-4">
        <Button onClick={handleSave} loading={saving} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button onClick={fetchSettings} variant="secondary">
          Reset
        </Button>
      </div>
    </Layout>
  );
}
