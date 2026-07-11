const Jansewa = require('./jansewaModel');

const getAllKendras = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Jansewa.countDocuments();
    const kendras = await Jansewa.find()
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      status: 'success',
      results: kendras.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: kendras
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const createKendra = async (req, res) => {
  try {
    const newKendra = await Jansewa.create(req.body);
    res.status(201).json({ status: 'success', data: newKendra });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

const getKendra = async (req, res) => {
  try {
    const kendra = await Jansewa.findById(req.params.id);
    res.status(200).json({ status: 'success', data: kendra });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Kendra not found' });
  }
};

module.exports = { getAllKendras, createKendra, getKendra };
