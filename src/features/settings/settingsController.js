const Settings = require('./settingsModel');

// Get all settings as a map
exports.getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    res.status(200).json({
      status: 'success',
      settings: settingsMap
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Update or create a setting
exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) throw new Error('Key is required');

    await Settings.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );

    res.status(200).json({
      status: 'success',
      message: `${key} updated successfully`
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Legacy support for API_KEY
exports.getApiKey = async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'API_KEY' });
    res.status(200).json({
      status: 'success',
      apiKey: setting ? setting.value : ''
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    await Settings.findOneAndUpdate(
      { key: 'API_KEY' },
      { value: apiKey },
      { upsert: true, new: true }
    );
    res.status(200).json({
      status: 'success',
      message: 'API Key updated successfully'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
