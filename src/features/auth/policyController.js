const getPolicies = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            policies: [
                { type: 'terms_conditions', url: 'https://joboapp.com/terms' },
                { type: 'privacy_policy', url: 'https://joboapp.com/privacy' }
            ]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getPolicies };
