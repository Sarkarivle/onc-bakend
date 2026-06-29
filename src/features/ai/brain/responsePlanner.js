function plan(input) {
  return {
    response: 'Main aapke sawal ko samajh kar verified data ke hisab se madad karunga.',
    format: 'HINGLISH'
  };
}

module.exports = { plan, analyze: plan, default: plan };
