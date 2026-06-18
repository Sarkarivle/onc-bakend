const Jansewa = require('./jansewaModel');

exports.getAllKendras = async (req, res) => {
  try {
    const kendras = await Jansewa.find();
    res.status(200).json({
      status: 'success',
      results: kendras.length,
      data: kendras
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.createKendra = async (req, res) => {
  try {
    const newKendra = await Jansewa.create(req.body);
    res.status(201).json({
      status: 'success',
      data: newKendra
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getKendra = async (req, res) => {
  try {
    const kendra = await Jansewa.findById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: kendra
    });
  } catch (err) {
    res.status(404).json({ status: 'fail', message: 'Kendra not found' });
  }
};
