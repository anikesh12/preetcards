import { useEffect, useState } from 'react';

/**
 * Renders nothing for Birthday cards. For any other occasion, shows a real
 * AdSense unit once ADSENSE_CLIENT_ID/ADSENSE_SLOT_ID are configured on the
 * backend, or a neutral placeholder before that (AdSense won't approve a
 * site that isn't live yet, so the placeholder lets the layout be verified
 * ahead of having a real account).
 */
export default function AdSlot({ occasion }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!config?.adsenseClientId) return;

    if (!document.querySelector('script[data-adsbygoogle]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsenseClientId}`;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-adsbygoogle', 'true');
      document.head.appendChild(script);
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // Blocked by an ad blocker or script not loaded yet -- the slot just won't fill.
    }
  }, [config]);

  if (!occasion || occasion === 'birthday' || !config) {
    return null;
  }

  if (config.adsenseClientId && config.adsenseSlotId) {
    return (
      <div className="ad-slot">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={config.adsenseClientId}
          data-ad-slot={config.adsenseSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <div className="ad-slot ad-slot--placeholder">
      Ad space (non-Birthday occasions)
    </div>
  );
}
