const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
    adsenseSlotId: process.env.ADSENSE_SLOT_ID || '',
    tipJarUrl: process.env.TIP_JAR_URL || '',
    rewardedAdClientId: process.env.REWARDED_AD_CLIENT_ID || '',
    rewardedAdUnitId: process.env.REWARDED_AD_UNIT_ID || '',
  });
});

module.exports = router;