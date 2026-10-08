// Judicial fee estimates (Law 90/1944 as amended by Law 126/2009).
// Ported as-is from the Aldiwan (wlywly) project's fee calculator: same brackets, same flat amounts.
// These are ESTIMATES for planning; the court clerk's assessment prevails.

export function calculateJudicialFees({ feeCategory, claimAmount, unspecifiedCourtType, defendantsCount, hasUrgentRequest }) {
  const amount = parseFloat(claimAmount) || 0;
  const defendants = Math.max(1, parseInt(defendantsCount, 10) || 1);

  // 1. Labor Cases (معفاة تماماً بنص القانون 12 لسنة 2003 - المادة 6)
  if (feeCategory === 'labor') {
    return {
      isExempt: true,
      exemptReason: 'معفاة تماماً بقوة القانون من كافة الرسوم القضائية ورسوم الإعلان ومصاريف التقاضي في جميع درجاته طبقاً للمادة 6 من قانون العمل رقم 12 لسنة 2003.',
      jurisdiction: 'المحكمة العمالية المختصة نوعياً بنظر المنازعات العمالية',
      totalAtFiling: 0,
      postJudgmentFee: 0,
      notes: 'لا يتم سداد أي رسوم أو دمغات أو ضرائب عند قيد الدعوى العمالية.'
    };
  }

  // 2. Family Cases (محاكم الأسرة - القانون رقم 1 لسنة 2000)
  if (feeCategory === 'family') {
    const basicFee = 20; // رسم جدول ثابت
    const judicialServicesFee = 10;
    const courtBuildings = 1.5;
    const lawyerFees = 50;
    const martyrStamp = 5;
    const familyFundStamp = 50;
    const subtotalBeforeTax = basicFee + judicialServicesFee + courtBuildings + lawyerFees + martyrStamp + familyFundStamp;
    const bailiffFee = defendants * 20;
    const professionalTax = 15;
    const vatTax = 20;
    const totalTax = professionalTax + vatTax;
    const totalAtFiling = subtotalBeforeTax + bailiffFee + totalTax;

    return {
      isExempt: false,
      isFixed: true,
      jurisdiction: 'محكمة الأسرة المختصة محلياً ونوعياً',
      basicFee,
      judicialServicesFee,
      courtBuildings,
      lawyerFees,
      martyrStamp,
      familyFundStamp,
      subtotalBeforeTax,
      bailiffFee,
      professionalTax,
      vatTax,
      totalTax,
      totalAtFiling,
      postJudgmentFee: 0,
      notes: 'دعاوى النفقات والأجور والحضانة والرؤية والخلوع معفاة من الرسوم النسبية طبقاً للقانون 1 لسنة 2000، ويسدد رسم الجدول ودمغة المحاماة وطابع صندوق الأسرة.'
    };
  }

  // 3. Cassation Cases (الطعن بالنقض)
  if (feeCategory === 'cassation') {
    const cassationDeposit = 1000; // كفالة النقض المدني والتجاري
    const basicFee = 250;
    const judicialServicesFee = 125;
    const courtBuildings = 1.5;
    const lawyerFees = 100;
    const martyrStamp = 5;
    const professionalTax = 15;
    const vatTax = 20;
    const totalTax = professionalTax + vatTax;
    const bailiffFee = defendants * 35;
    const subtotalBeforeTax = basicFee + judicialServicesFee + courtBuildings + lawyerFees + martyrStamp + cassationDeposit;
    const totalAtFiling = subtotalBeforeTax + bailiffFee + totalTax;

    return {
      isExempt: false,
      isFixed: true,
      jurisdiction: 'محكمة النقض (دار القضاء العالي)',
      basicFee,
      judicialServicesFee,
      courtBuildings,
      lawyerFees,
      martyrStamp,
      depositSecurity: cassationDeposit,
      subtotalBeforeTax,
      bailiffFee,
      professionalTax,
      vatTax,
      totalTax,
      totalAtFiling,
      postJudgmentFee: 0,
      notes: 'تشمل الرسوم كفالة الطعن بالنقض المقررة قانوناً (1000 جنيه) وتسترد حال قبول الطعن ونقض الحكم.'
    };
  }

  // 4. صحة التوقيع (المادة 76 بند 1 من القانون 90 لسنة 1944)
  if (feeCategory === 'signature_validity') {
    const basicFee = 5; // رسم ثابت 5 جنيهات أمام المحكمة الجزئية
    const judicialServicesFee = 2.5; // 50%
    const courtBuildings = 1.5;
    const lawyerFees = 50;
    const martyrStamp = 5;
    const subtotalBeforeTax = basicFee + judicialServicesFee + courtBuildings + lawyerFees + martyrStamp;
    const professionalTax = 15;
    const vatTax = 20;
    const totalTax = professionalTax + vatTax;
    const bailiffFee = defendants * 25;
    const totalAtFiling = subtotalBeforeTax + bailiffFee + totalTax;

    return {
      isExempt: false,
      isFixed: true,
      jurisdiction: 'محكمة المواد الجزئية (اختصاص نوعي بقوة القانون مهما بلغت قيمة العقد)',
      basicFee,
      judicialServicesFee,
      courtBuildings,
      lawyerFees,
      martyrStamp,
      subtotalBeforeTax,
      bailiffFee,
      professionalTax,
      vatTax,
      totalTax,
      totalAtFiling,
      postJudgmentFee: 0,
      notes: 'دعوى صحة التوقيع مجهولة القيمة بنص المادة 76 بند 1 من قانون الرسوم، ورسمها ثابت 5 جنيهات ولا يتأثر بقيمة العقد المكتوب، وتختص بها المحكمة الجزئية نوعياً.'
    };
  }

  // 5. الدعاوى مجهولة / غير مقدرة القيمة (المادة 1 والمادة 3 من القانون 90 لسنة 1944 المعدل بالقانون 126 لسنة 2009)
  if (feeCategory === 'civil_unspecified' || feeCategory === 'urgent_action') {
    let basicFee = 5;
    let jurisdictionText = 'محكمة المواد الجزئية';

    if (unspecifiedCourtType === 'partial') {
      basicFee = 5;
      jurisdictionText = 'محكمة المواد الجزئية';
    } else if (unspecifiedCourtType === 'urgent' || feeCategory === 'urgent_action') {
      basicFee = 10;
      jurisdictionText = 'محكمة الأمور المستعجلة';
    } else if (unspecifiedCourtType === 'first_instance') {
      basicFee = 15;
      jurisdictionText = 'المحكمة الابتدائية (الكلية)';
    } else if (unspecifiedCourtType === 'bankruptcy') {
      basicFee = 50;
      jurisdictionText = 'المحكمة الاقتصادية / الكلية (دائرة الإفلاس)';
    } else if (unspecifiedCourtType === 'appeal_partial') {
      basicFee = 10;
      jurisdictionText = 'المحكمة الابتدائية بهيئة استئنافية';
    } else if (unspecifiedCourtType === 'appeal_urgent') {
      basicFee = 15;
      jurisdictionText = 'محكمة استئناف القضاء المستعجل';
    } else if (unspecifiedCourtType === 'appeal_high') {
      basicFee = 30;
      jurisdictionText = 'محكمة الاستئناف العالي';
    }

    const judicialServicesFee = basicFee * 0.5; // 50%
    const courtBuildings = 1.5;
    const lawyerFees = (unspecifiedCourtType === 'appeal_high' || unspecifiedCourtType === 'first_instance') ? 75 : 50;
    const martyrStamp = 5;
    const subtotalBeforeTax = basicFee + judicialServicesFee + courtBuildings + lawyerFees + martyrStamp;
    const professionalTax = 15;
    const vatTax = 20;
    const totalTax = professionalTax + vatTax;
    const bailiffFee = defendants * 25;
    const totalAtFiling = subtotalBeforeTax + bailiffFee + totalTax;

    return {
      isExempt: false,
      isFixed: true,
      jurisdiction: jurisdictionText,
      basicFee,
      judicialServicesFee,
      courtBuildings,
      lawyerFees,
      martyrStamp,
      subtotalBeforeTax,
      bailiffFee,
      professionalTax,
      vatTax,
      totalTax,
      totalAtFiling,
      postJudgmentFee: 0,
      notes: 'الدعاوى مجهولة القيمة تخضع للرسم الثابت بحسب درجة المحكمة (مادة 1 ومادة 3)، ويكتفى بالرسم المسدد إذا رُفضت الدعوى دون صدور أمر تقدير، ما لم تعدل لطلبات معلومة القيمة.'
    };
  }

  // 6. الدعاوى معلومة القيمة (مطالبة مالية، أمر أداء، استئناف مدني)
  // حساب الشرائح التصاعدية للرسم النسبي الكامل (المادة 1 من القانون 90 لسنة 1944):
  // الشريحة 1: حتى 250 جنيه بنسبة 2%
  // الشريحة 2: من 250 إلى 2000 جنيه (1750 جنيه) بنسبة 3%
  // الشريحة 3: من 2000 إلى 4000 جنيه (2000 جنيه) بنسبة 4%
  // الشريحة 4: ما زاد عن 4000 جنيه بنسبة 5%
  const calcProportionalFeeByBrackets = (val) => {
    let b1 = 0, b2 = 0, b3 = 0, b4 = 0;
    if (val <= 250) {
      b1 = val * 0.02;
    } else if (val <= 2000) {
      b1 = 250 * 0.02;
      b2 = (val - 250) * 0.03;
    } else if (val <= 4000) {
      b1 = 250 * 0.02;
      b2 = 1750 * 0.03;
      b3 = (val - 2000) * 0.04;
    } else {
      b1 = 250 * 0.02;
      b2 = 1750 * 0.03;
      b3 = 2000 * 0.04;
      b4 = (val - 4000) * 0.05;
    }
    const total = b1 + b2 + b3 + b4;
    return { total, b1, b2, b3, b4 };
  };

  // حساب الرسم النسبي الإجمالي الكامل لكامل قيمة المطالبة
  const fullFeeBrackets = calcProportionalFeeByBrackets(amount);
  const fullProportionalFee = fullFeeBrackets.total;
  const fullServicesFee = fullProportionalFee * 0.5; // 50% صندوق الخدمات
  const fullTotalJudicial = fullProportionalFee + fullServicesFee;

  // حساب الوعاء المؤقت للرسم الابتدائي المسدد عند الرفع (المادة 9 من قانون الرسوم 126/2009):
  // - الدعاوى حتى 40,000: تحسب على أساس 1,000 جنيه (أو القيمة إن كانت أقل)
  // - الدعاوى من 40,001 إلى 100,000: يحصل الرسم النسبي عند الرفع على أساس 2,000 جنيه فقط
  // - الدعاوى من 100,001 إلى 1,000,000: يحصل الرسم عند الرفع على أساس 5,000 جنيه
  // - ما زاد عن 1,000,000: يحصل الرسم عند الرفع على أساس 10,000 جنيه
  let filingBaseAmount = amount;
  if (amount <= 40000) {
    filingBaseAmount = Math.min(amount, 1000);
  } else if (amount <= 100000) {
    filingBaseAmount = 2000;
  } else if (amount <= 1000000) {
    filingBaseAmount = 5000;
  } else {
    filingBaseAmount = 10000;
  }

  const filingFeeBrackets = calcProportionalFeeByBrackets(filingBaseAmount);
  const filingProportionalFee = filingFeeBrackets.total; // 57.5 في حالة 50 ألف
  const judicialServicesFee = filingProportionalFee * 0.5; // 28.75 في حالة 50 ألف
  const courtBuildings = 1.5; // ص أبنية المحاكم
  const lawyerFees = (amount > 100000 || feeCategory === 'appeal_civil') ? 75 : 50; // أتعاب المحاماة
  const martyrStamp = 5.0; // دمغة الشهيد

  // الإجمالي قبل الضرائب (الرسوم القضائية والملحقات المسددة)
  const subtotalBeforeTax = filingProportionalFee + judicialServicesFee + courtBuildings + lawyerFees + martyrStamp; // 142.75

  // الضرائب المقررة:
  const professionalTax = 15.0; // ضريبة المهن
  const vatTax = 20.0; // ض القيمة المضافة
  const totalTax = professionalTax + vatTax; // 35.0

  // مصاريف الإعلان بالمحضرين
  const bailiffFee = defendants * 25;

  // كفالة استئناف (إن وجدت)
  const depositSecurity = feeCategory === 'appeal_civil' ? (amount > 100000 ? 500 : 200) : 0;

  // شق مستعجل
  const urgentFee = hasUrgentRequest ? 25 : 0;

  // إجمالي المدفوع عند رفع الدعوى
  const totalAtFiling = subtotalBeforeTax + totalTax + bailiffFee + depositSecurity + urgentFee;

  // حساب قوائم الرسوم (أمر التقدير النهائي الصادر بعد الحكم ضد الخاسر):
  // الباقي من النسبي = الكامل - المسدد عند القيد
  const remainingProportional = Math.max(0, fullProportionalFee - filingProportionalFee); // 2380 في حالة 50 ألف
  // الباقي من الخدمات = الخدمات الكامل - المسدد عند القيد
  const remainingServices = Math.max(0, fullServicesFee - judicialServicesFee); // 1190 في حالة 50 ألف
  const totalPostJudgment = remainingProportional + remainingServices; // 3570

  // الاختصاص القيمي والنوعي:
  let jurisdiction = 'ترفع أمام محكمة المواد الجزئية';
  if (feeCategory === 'appeal_civil') {
    jurisdiction = amount <= 100000 ? 'المحكمة الابتدائية بهيئة استئنافية' : 'محكمة الاستئناف العالي';
  } else if (amount > 100000) {
    jurisdiction = 'ترفع أمام المحكمة الابتدائية (المحكمة الكلية)';
  }

  return {
    isExempt: false,
    isFixed: false,
    amount,
    filingBaseAmount,
    jurisdiction,
    // تفاصيل الرسم الابتدائي
    filingProportionalFee,
    judicialServicesFee,
    courtBuildings,
    lawyerFees,
    martyrStamp,
    subtotalBeforeTax,
    professionalTax,
    vatTax,
    totalTax,
    bailiffFee,
    depositSecurity,
    urgentFee,
    totalAtFiling,
    // تفاصيل قوائم الرسوم النهائية
    fullProportionalFee,
    fullServicesFee,
    fullTotalJudicial,
    remainingProportional,
    remainingServices,
    totalPostJudgment,
    postJudgmentFee: totalPostJudgment,
    // تفاصيل الشرائح
    fullFeeBrackets,
    filingFeeBrackets,
    notes: 'يُحصل الرسم النسبي عند رفع الدعوى بحد أقصى على أساس الشريحة المؤقتة (مادة 9)، ويستحق باقي الرسم النسبي وصندوق الخدمات بقائمة رسوم بعد صدور الحكم ويلزم بها الخصم الخاسر.'
  };
}

export const FEE_CATEGORY_LABELS = {
  civil_monetary: 'دعوى مدنية / تجارية معلومة القيمة (مطالبة مالية، تعويض، رصيد حساب)',
  payment_order: 'استصدار أمر أداء (شيك، كمبيالة، إيصال أمانة، سند إذني)',
  signature_validity: 'دعوى صحة توقيع (رسم ثابت 5 ج - اختصاص نوعي جزئي)',
  civil_unspecified: 'دعوى غير مقدرة القيمة (صحة ونفاذ، تثبيت ملكية، فسخ، طرد، تسليم)',
  urgent_action: 'منازعة مستعجلة (طرد مستعجل، إثبات حالة، وقف أعمال جديدة)',
  appeal_civil: 'استئناف حكم مدني / تجاري',
  cassation: 'طعن بالنقض (مدني / تجاري / جنائي)',
  family: 'دعاوى محكمة الأسرة (نفقات، طلاق، خلع، رؤية، حضانة)',
  labor: 'دعاوى عمالية (مستحقات عمالية، فصل تعسفي - معفاة بقوة القانون)'
}
