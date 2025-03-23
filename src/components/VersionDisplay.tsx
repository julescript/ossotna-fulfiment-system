import { useEffect, useState } from 'react';

interface VersionInfo {
  version: string;
  lastUpdated: string;
}

export default function VersionDisplay() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load version info
    fetch('/version.json')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load version info: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (!data.version) {
          throw new Error('Invalid version data');
        }
        setVersionInfo(data);
        setError(null);
      })
      .catch(err => {
        console.error('Error loading version:', err);
        setError('Dev');
      });
  }, []);

  if (error) {
    return (
      <div className="text-center text-sm text-gray-500">
        <span>Version {error}</span>
      </div>
    );
  }

  if (!versionInfo) {
    return (
      <div className="text-center text-sm text-gray-500">
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="text-center text-sm text-gray-500">
      <span>version {versionInfo.version}</span>
    </div>
  );
}
