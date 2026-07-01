const Settings = require('./settingsModel');

/**
 * GET /api/v1/settings
 */
const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.status(200).json({ status: 'success', settings: settingsMap });
  } catch (err) {
    console.error('❌ Get All Settings Error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/v1/settings/update
 * Body: { key, value }
 */
const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
        return res.status(400).json({ status: 'error', message: 'Key is required' });
    }

    console.log(`⚙️ Updating setting: ${key} = ${value}`);

    const setting = await Settings.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
        status: 'success',
        message: `${key} updated successfully`,
        data: setting
    });
  } catch (err) {
    console.error(`❌ Update Setting Error (${req.body?.key}):`, err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/v1/settings/api-key (Deprecated/Specialized)
 */
const getApiKey = async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'API_KEY' });
    res.status(200).json({ status: 'success', apiKey: setting ? setting.value : '' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/v1/settings/api-key (Deprecated/Specialized)
 */
const updateApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    const setting = await Settings.findOneAndUpdate(
        { key: 'API_KEY' },
        { value: apiKey },
        { upsert: true, new: true }
    );
    res.status(200).json({ status: 'success', message: 'API Key updated successfully', data: setting });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = { getAllSettings, updateSetting, getApiKey, updateApiKey };
