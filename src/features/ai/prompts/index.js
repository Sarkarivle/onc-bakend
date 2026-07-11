const getPersona = require('./persona');
const getFormatting = require('./formatting');
const jobMode = require('./modes/jobMode');
const adviceMode = require('./modes/adviceMode');
const wellnessMode = require('./modes/wellnessMode');
const mathMode = require('./modes/mathMode');
const utilityMode = require('./modes/utilityMode');
const draftingMode = require('./modes/draftingMode');
const interviewMode = require('./modes/interviewMode');
const watchmanMode = require('./modes/watchmanMode');
const guruMode = require('./modes/guruMode');
const architectMode = require('./modes/architectMode');
const auditorMode = require('./modes/auditorMode');
const grantMode = require('./modes/grantMode');
const syllabusMode = require('./modes/syllabusMode');
const pyqMode = require('./modes/pyqMode');
const conceptMode = require('./modes/conceptMode');
const shortcutMode = require('./modes/shortcutMode');
const vocabMode = require('./modes/vocabMode');
const gkDigestMode = require('./modes/gkDigestMode');
const testStrategyMode = require('./modes/testStrategyMode');
const mnemonicMode = require('./modes/mnemonicMode');
const practicalScienceMode = require('./modes/practicalScienceMode');
const noteNinjaMode = require('./modes/noteNinjaMode');
const linkedinGuruMode = require('./modes/linkedinGuruMode');
const networkingMode = require('./modes/networkingMode');
const negotiatorMode = require('./modes/negotiatorMode');
const pivotMode = require('./modes/pivotMode');
const jdDecoderMode = require('./modes/jdDecoderMode');
const emailProMode = require('./modes/emailProMode');
const bodyLanguageMode = require('./modes/bodyLanguageMode');
const partTimeMode = require('./modes/partTimeMode');
const studentSavingsMode = require('./modes/studentSavingsMode');
const feeWaiverMode = require('./modes/feeWaiverMode');
const motivationMode = require('./modes/motivationMode');
const distractionGuardMode = require('./modes/distractionGuardMode');
const timeBoxMode = require('./modes/timeBoxMode');
const habitBuilderMode = require('./modes/habitBuilderMode');
const procrastinationMode = require('./modes/procrastinationMode');
const codingBasicsMode = require('./modes/codingBasicsMode');
const aiLiteracyMode = require('./modes/aiLiteracyMode');
const dataSkillsMode = require('./modes/dataSkillsMode');
const cyberSafetyMode = require('./modes/cyberSafetyMode');
const creatorMode = require('./modes/creatorMode');
const sscExpertMode = require('./modes/sscExpertMode');
const policeExpertMode = require('./modes/policeExpertMode');
const railwayExpertMode = require('./modes/railwayExpertMode');
const bankingExpertMode = require('./modes/bankingExpertMode');
const teacherExpertMode = require('./modes/teacherExpertMode');
const upscFoundationMode = require('./modes/upscFoundationMode');
const englishPracticeMode = require('./modes/englishPracticeMode');
const stageConfidenceMode = require('./modes/stageConfidenceMode');
const gdMasterMode = require('./modes/gdMasterMode');
const backupPlanMode = require('./modes/backupPlanMode');
const localScoutMode = require('./modes/localScoutMode');
const trendPredictorMode = require('./modes/trendPredictorMode');
const startupFounderMode = require('./modes/startupFounderMode');
const higherStudiesMode = require('./modes/higherStudiesMode');
const studentRightsMode = require('./modes/studentRightsMode');
const scamProtectorMode = require('./modes/scamProtectorMode');
const rtiHelperMode = require('./modes/rtiHelperMode');
const formErrorGuardMode = require('./modes/formErrorGuardMode');
const ruralEmpowerMode = require('./modes/ruralEmpowerMode');

const getModePrompt = (intent) => {
    const modes = {
        'JOB_SEARCH': jobMode(),
        'CAREER_ADVICE': adviceMode(),
        'WELLNESS': wellnessMode(),
        'MATH': mathMode(),
        'UTILITY': utilityMode(),
        'DRAFTING': draftingMode(),
        'INTERVIEW': interviewMode(),
        'NEWS': watchmanMode(),
        'SOFT_SKILLS': guruMode(),
        'ROADMAP': architectMode(),
        'ACADEMIC_AUDIT': auditorMode(),
        'GRANTS': grantMode(),
        'SYLLABUS': syllabusMode(),
        'PYQ': pyqMode(),
        'CONCEPT': conceptMode(),
        'SHORTCUT': shortcutMode(),
        'VOCAB': vocabMode(),
        'GK_DIGEST': gkDigestMode(),
        'TEST_STRATEGY': testStrategyMode(),
        'MNEMONIC': mnemonicMode(),
        'PRACTICAL_SCIENCE': practicalScienceMode(),
        'NOTE_NINJA': noteNinjaMode(),
        'LINKEDIN': linkedinGuruMode(),
        'NETWORKING': networkingMode(),
        'NEGOTIATOR': negotiatorMode(),
        'PIVOT': pivotMode(),
        'JD_DECODER': jdDecoderMode(),
        'EMAIL_PRO': emailProMode(),
        'BODY_LANGUAGE': bodyLanguageMode(),
        'PART_TIME': partTimeMode(),
        'SAVINGS': studentSavingsMode(),
        'FEE_WAIVER': feeWaiverMode(),
        'MOTIVATION': motivationMode(),
        'DISTRACTION': distractionGuardMode(),
        'TIME_BOX': timeBoxMode(),
        'HABIT': habitBuilderMode(),
        'PROCRASTINATION': procrastinationMode(),
        'CODING': codingBasicsMode(),
        'AI_LITERACY': aiLiteracyMode(),
        'DATA_SKILLS': dataSkillsMode(),
        'CYBER_SAFETY': cyberSafetyMode(),
        'CREATOR': creatorMode(),
        'SSC': sscExpertMode(),
        'POLICE': policeExpertMode(),
        'RAILWAY': railwayExpertMode(),
        'BANKING': bankingExpertMode(),
        'TEACHER': teacherExpertMode(),
        'UPSC': upscFoundationMode(),
        'ENGLISH_PRACTICE': englishPracticeMode(),
        'STAGE_CONFIDENCE': stageConfidenceMode(),
        'GD_MASTER': gdMasterMode(),
        'BACKUP_PLAN': backupPlanMode(),
        'LOCAL_SCOUT': localScoutMode(),
        'TREND_PREDICTOR': trendPredictorMode(),
        'STARTUP': startupFounderMode(),
        'HIGHER_STUDIES': higherStudiesMode(),
        'STUDENT_RIGHTS': studentRightsMode(),
        'SCAM_PROTECTOR': scamProtectorMode(),
        'RTI_HELPER': rtiHelperMode(),
        'FORM_GUARD': formErrorGuardMode(),
        'RURAL_EMPOWER': ruralEmpowerMode(),
        'GENERAL': `# MODE: CONVERSATIONAL\nKeep it friendly, short, and helpful. Ask how their preparation is going.`
    };
    return modes[intent] || modes['GENERAL'];
};

module.exports = { getPersona, getFormatting, getModePrompt };
