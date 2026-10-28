import { 
  Ingredient, 
  Product, 
  Recipe, 
  ExpenseItem, 
  PurchaseInvoice,
  CashierAccount,
  CashierShift,
  PaymentFeeRule,
  Promotion,
  PosOrder,
  PaymentRecord,
  RefundRecord,
  ManagerApprovalRequest
} from '../types';

export const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing_guava',
    nameAr: 'جوافة',
    nameEn: 'Guava',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 35,
    pricePerBaseUnit: 0.035,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 35, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'وزن كامل مستخدم في الخلط'
  },
  {
    id: 'ing_strawberry',
    nameAr: 'فراولة',
    nameEn: 'Strawberry',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 50,
    pricePerBaseUnit: 0.05,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 50, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'فراولة بلدي طازجة منزوعة القمع'
  },
  {
    id: 'ing_orange',
    nameAr: 'برتقال',
    nameEn: 'Orange',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 20,
    pricePerBaseUnit: 0.02,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 20, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100, // 2.5 kg whole oranges in recipe produces 1,000 ml juice -> 50 EGP total batch cost
    wastePercentage: 0,
    isMeasured: true,
    notes: '2.5 كجم برتقال بقشره يعطي 1000 مل عصير صافي بدون ماء'
  },
  {
    id: 'ing_mango',
    nameAr: 'مانجو',
    nameEn: 'Mango',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 60,
    pricePerBaseUnit: 0.06,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 60, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'مانجو زبدية / سكري قبل التقشير'
  },
  {
    id: 'ing_cantaloupe',
    nameAr: 'كنتالوب',
    nameEn: 'Cantaloupe',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 30,
    pricePerBaseUnit: 0.03,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 30, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'كنتالوب كامل قبل التقشير والبذر'
  },
  {
    id: 'ing_watermelon',
    nameAr: 'بطيخ',
    nameEn: 'Watermelon',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 20,
    pricePerBaseUnit: 0.02,
    baseUnit: 'g',
    supplier: 'سوق العبور',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 20, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'بطيخ كامل بالقشر'
  },
  {
    id: 'ing_sugar',
    nameAr: 'سكر',
    nameEn: 'Sugar',
    category: 'سكريات ومحليات',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 35,
    pricePerBaseUnit: 0.035,
    baseUnit: 'g',
    supplier: 'تاجر الجملة',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 35, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true
  },
  {
    id: 'ing_milk_powder',
    nameAr: 'لبن بودرة',
    nameEn: 'Milk powder',
    category: 'ألبان وكريمات',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 300,
    pricePerBaseUnit: 0.3,
    baseUnit: 'g',
    supplier: 'مستلزمات حلواني',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 300, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true
  },
  {
    id: 'ing_cream_powder',
    nameAr: 'بودرة كريم شانتيه',
    nameEn: 'Whipping cream powder',
    category: 'ألبان وكريمات',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 300,
    pricePerBaseUnit: 0.3,
    baseUnit: 'g',
    supplier: 'مستلزمات حلواني',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 300, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true
  },
  {
    id: 'ing_vanilla_powder',
    nameAr: 'فانيليا بودرة',
    nameEn: 'Vanilla powder',
    category: 'نكهات ومواد مضافة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 400,
    pricePerBaseUnit: 0.4,
    baseUnit: 'g',
    supplier: 'مستلزمات حلواني',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 400, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true
  },
  {
    id: 'ing_liquid_vanilla',
    nameAr: 'فانيليا سائلة',
    nameEn: 'Liquid vanilla',
    category: 'نكهات ومواد مضافة',
    purchaseUnit: 'l',
    packageSize: 1,
    currentPrice: 500,
    pricePerBaseUnit: 0.5,
    baseUnit: 'ml',
    supplier: 'مستلزمات حلواني',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 500, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true
  },
  {
    id: 'ing_citric_acid',
    nameAr: 'ملح ليمون / حامض الستريك',
    nameEn: 'Citric acid',
    category: 'نكهات ومواد مضافة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 60,
    pricePerBaseUnit: 0.06,
    baseUnit: 'g',
    supplier: 'عطارة وجملة',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 60, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'تحقق من النسبة المسموح بها صحياً'
  },
  {
    id: 'ing_tamarind_flavor',
    nameAr: 'أسانس تمر هندي سائل',
    nameEn: 'Liquid tamarind flavor',
    category: 'نكهات ومواد مضافة',
    purchaseUnit: 'l',
    packageSize: 1,
    currentPrice: 900,
    pricePerBaseUnit: 0.9,
    baseUnit: 'ml',
    supplier: 'مستلزمات طعام ونكهات',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 900, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: false,
    notes: 'غير مقاس بدقة في وصفة التمر الهندي الشعبي'
  },
  {
    id: 'ing_food_coloring',
    nameAr: 'لون طعام',
    nameEn: 'Food coloring',
    category: 'نكهات ومواد مضافة',
    purchaseUnit: 'g',
    packageSize: 50,
    currentPrice: 20, // 20 EGP per 50 grams = 0.4 EGP/g
    pricePerBaseUnit: 0.4,
    baseUnit: 'g',
    supplier: 'مستلزمات حلواني',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 20, note: 'تقديري 20 ج لكل 50 جرام' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'تحذير صحي: تأكد من التصريح الغذائي للون'
  },
  {
    id: 'ing_aswan_tamarind',
    nameAr: 'تمر هندي أسواني طبيعي',
    nameEn: 'Aswan tamarind',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 50,
    pricePerBaseUnit: 0.05,
    baseUnit: 'g',
    supplier: 'عطارة أسوان',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 50, note: 'سعر البداية الافتتاحي' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: false,
    notes: 'يحتاج استكمال قياسات السكر والإضافات الأخرى'
  },
  {
    id: 'ing_sugarcane',
    nameAr: 'قصب سكر',
    nameEn: 'Sugarcane',
    category: 'فواكه طازجة',
    purchaseUnit: 'bundle',
    packageSize: 8, // 8 stalks per bundle
    currentPrice: 30, // 30 EGP per bundle
    pricePerBaseUnit: 3.75, // 3.75 EGP per stalk
    baseUnit: 'piece',
    supplier: 'مزارع الصعيد',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 30, note: '30 ج للرابطة (8 عيدان)' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: false,
    notes: 'العود الواحد ينتج كوب 400 مل تقريباً مع الثلج. لم يتم قياس العائد الصافي باللتر.'
  },
  {
    id: 'ing_water',
    nameAr: 'مياه مفلترة',
    nameEn: 'Filtered water',
    category: 'أخرى',
    purchaseUnit: 'l',
    packageSize: 1,
    currentPrice: 0,
    pricePerBaseUnit: 0,
    baseUnit: 'ml',
    supplier: 'فلتر المحل',
    lastUpdated: '2026-10-11',
    priceHistory: [{ date: '2026-10-11', price: 0, note: 'مياه مفلترة (ضمن فاتورة المياه الشهرية)' }],
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: 'تكلفة الوحدة غير محددة مباشرة، مشمولة في مصاريف المرافق'
  }
];

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rec_guava',
    productId: 'prod_guava',
    nameAr: 'وصفة الجوافة الطبيعية',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_guava', quantity: 1.5, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 600, unit: 'ml' }
    ],
    batchYieldMl: 1800,
    isComplete: true,
    hasAddedSugar: false,
    marketingAlert: 'بدون إضافة سكر في هذه الوصفة الأساسية',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_strawberry',
    productId: 'prod_strawberry',
    nameAr: 'وصفة الفراولة الطازجة',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_strawberry', quantity: 1.5, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 600, unit: 'ml' },
      { ingredientId: 'ing_sugar', quantity: 200, unit: 'g' }
    ],
    batchYieldMl: 2000,
    isComplete: true,
    hasAddedSugar: true,
    marketingAlert: 'تحتوي على سكر مضاف (200 جم) — لا تعلن "بدون سكر"',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_orange',
    productId: 'prod_orange',
    nameAr: 'وصفة البرتقال الصافي المعصور',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_orange', quantity: 2.5, unit: 'kg' }
    ],
    batchYieldMl: 1000,
    isComplete: true,
    hasAddedSugar: false,
    marketingAlert: 'عصير طبيعي 100% بدون أي ماء أو سكر مضاف',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_mango',
    productId: 'prod_mango',
    nameAr: 'وصفة المانجو الطبيعية',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_mango', quantity: 1, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 300, unit: 'ml' },
      { ingredientId: 'ing_sugar', quantity: 150, unit: 'g' }
    ],
    batchYieldMl: 1200,
    isComplete: true,
    hasAddedSugar: true,
    marketingAlert: 'تحتوي على سكر مضاف (150 جم) — لا تعلن "بدون سكر"',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_cantaloupe',
    productId: 'prod_cantaloupe',
    nameAr: 'وصفة الكنتالوب المنعش',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_cantaloupe', quantity: 1, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 300, unit: 'ml' },
      { ingredientId: 'ing_sugar', quantity: 250, unit: 'g' }
    ],
    batchYieldMl: 1200,
    isComplete: true,
    hasAddedSugar: true,
    marketingAlert: 'تحتوي على سكر مضاف (250 جم) — لا تعلن "بدون سكر"',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_watermelon',
    productId: 'prod_watermelon',
    nameAr: 'وصفة البطيخ المثلج',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_watermelon', quantity: 5, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 200, unit: 'ml' },
      { ingredientId: 'ing_sugar', quantity: 600, unit: 'g' }
    ],
    batchYieldMl: 3000,
    isComplete: true,
    hasAddedSugar: true,
    marketingAlert: 'تحتوي على سكر مضاف (600 جم) — لا تعلن "بدون سكر"',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_sobia',
    productId: 'prod_sobia',
    nameAr: 'وصفة السوبيا المصرية الغنية',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_milk_powder', quantity: 1, unit: 'kg' },
      { ingredientId: 'ing_cream_powder', quantity: 200, unit: 'g' },
      { ingredientId: 'ing_vanilla_powder', quantity: 10, unit: 'g' },
      { ingredientId: 'ing_liquid_vanilla', quantity: 10, unit: 'ml' },
      { ingredientId: 'ing_sugar', quantity: 2, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 9, unit: 'l' }
    ],
    batchYieldMl: 10000, // 10 liters
    isComplete: true,
    hasAddedSugar: true,
    marketingAlert: 'سوبيا غنية باللبن والسكر والفانيليا',
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_sugarcane',
    productId: 'prod_sugarcane',
    nameAr: 'وصفة عصير القصب الطازج',
    method: 'per_serving',
    ingredients: [
      { ingredientId: 'ing_sugarcane', quantity: 1, unit: 'piece', notes: 'عود قصب للكوب 400 مل مع ثلج' }
    ],
    batchYieldMl: 400,
    isComplete: false,
    incompleteReason: 'عائد العصير الصافي باللتر لم يتم قياسه مخبرياً، التكلفة تقديرية للكوب فقط مع الثلج',
    hasAddedSugar: false,
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_local_tamarind',
    productId: 'prod_local_tamarind',
    nameAr: 'وصفة التمر الهندي الشعبي',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_sugar', quantity: 2, unit: 'kg' },
      { ingredientId: 'ing_citric_acid', quantity: 200, unit: 'g' },
      { ingredientId: 'ing_food_coloring', quantity: 50, unit: 'g' },
      { ingredientId: 'ing_tamarind_flavor', quantity: 50, unit: 'ml', notes: 'الكمية غير مقاسة بدقة' },
      { ingredientId: 'ing_water', quantity: 14, unit: 'l' }
    ],
    batchYieldMl: 15000, // approx 15 liters
    isComplete: false,
    incompleteReason: 'كمية أسانس التمر الهندي لم تقاس بدقة، والوصفة غير معتمدة للإنتاج النهائي حتى فحص نسب الملونات والأحماض',
    safetyNotes: 'تحذير أمان: فحص تركيز ملح الليمون وأسانس التمر واللون المصرح به قبل الاعتماد التجاري',
    hasAddedSugar: true,
    lastUpdated: '2026-10-11'
  },
  {
    id: 'rec_aswan_tamarind',
    productId: 'prod_aswan_tamarind',
    nameAr: 'وصفة التمر الهندي الأسواني الطبيعي',
    method: 'batch',
    ingredients: [
      { ingredientId: 'ing_aswan_tamarind', quantity: 1, unit: 'kg' },
      { ingredientId: 'ing_water', quantity: 1.5, unit: 'l' }
    ],
    batchYieldMl: 1500,
    isComplete: false,
    incompleteReason: 'باقي المكونات (كمية السكر) وسعر البيع غير محددين بعد',
    hasAddedSugar: false,
    lastUpdated: '2026-10-11'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_guava',
    nameAr: 'جوافة',
    nameEn: 'Guava',
    category: 'عصائر طبيعية',
    recipeId: 'rec_guava',
    prices: { '400ml': 40, '1L': 70 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_strawberry',
    nameAr: 'فراولة',
    nameEn: 'Strawberry',
    category: 'عصائر طبيعية',
    recipeId: 'rec_strawberry',
    prices: { '400ml': 40, '1L': 70 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_orange',
    nameAr: 'برتقال',
    nameEn: 'Orange',
    category: 'عصائر طبيعية',
    recipeId: 'rec_orange',
    prices: { '400ml': 40, '1L': 70 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_mango',
    nameAr: 'مانجو',
    nameEn: 'Mango',
    category: 'عصائر طبيعية',
    recipeId: 'rec_mango',
    prices: { '400ml': 50, '1L': 90 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_cantaloupe',
    nameAr: 'كنتالوب',
    nameEn: 'Cantaloupe',
    category: 'عصائر طبيعية',
    recipeId: 'rec_cantaloupe',
    prices: { '400ml': 40, '1L': 80 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_watermelon',
    nameAr: 'بطيخ',
    nameEn: 'Watermelon',
    category: 'عصائر طبيعية',
    recipeId: 'rec_watermelon',
    prices: { '400ml': 40, '1L': 80 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_sobia',
    nameAr: 'سوبيا',
    nameEn: 'Sobia',
    category: 'مشروبات تقليدية',
    recipeId: 'rec_sobia',
    prices: { '400ml': 40, '1L': 70 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: true
  },
  {
    id: 'prod_sugarcane',
    nameAr: 'قصب سكر',
    nameEn: 'Sugarcane',
    category: 'عصائر طازجة',
    recipeId: 'rec_sugarcane',
    prices: { '400ml': 20, '1L': 40 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: false,
    incompleteNotes: 'صافي عصير اللتر غير مقاس رسمياً (تكلفة الكوب 400 مل محسوبة بـ 1 عود)'
  },
  {
    id: 'prod_local_tamarind',
    nameAr: 'تمر هندي شعبي',
    nameEn: 'Local Tamarind',
    category: 'مشروبات شعبية',
    recipeId: 'rec_local_tamarind',
    prices: { '400ml': 20, '1L': 50 },
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: false,
    incompleteNotes: 'الوصفة غير معتمدة للإنتاج — مقادير الأسانس غير مقاسة بدقة ويجب مراجعة نسب الألوان المضافة',
    safetyNotice: 'فحص نسب الملونات وحامض الستريك قبل الاعتماد'
  },
  {
    id: 'prod_aswan_tamarind',
    nameAr: 'تمر هندي أسواني',
    nameEn: 'Aswan Tamarind',
    category: 'مشروبات طبيعية',
    recipeId: 'rec_aswan_tamarind',
    prices: { '400ml': 0, '1L': 0 }, // Prices unknown / not assumed
    packaging: { '400ml': 4, '1L': 6 },
    servingMl: { '400ml': 400, '1L': 1000 },
    isComplete: false,
    incompleteNotes: 'أسعار البيع وباقي الإضافات غير محددة — منتج قيد الإعداد'
  }
];

export const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: 'exp_rent', nameAr: 'إيجار المحل (وسط البلد)', nameEn: 'Rent', monthlyAmount: 5000, type: 'fixed', category: 'rent' },
  { id: 'exp_elec', nameAr: 'كهرباء وثلاجات', nameEn: 'Electricity', monthlyAmount: 4000, type: 'fixed', category: 'utilities' },
  { id: 'exp_water', nameAr: 'مياه ومرافق', nameEn: 'Water utility', monthlyAmount: 150, type: 'fixed', category: 'utilities' },
  { id: 'exp_gas', nameAr: 'غاز طبيعي', nameEn: 'Gas', monthlyAmount: 0, type: 'fixed', category: 'utilities' },
  { id: 'exp_net', nameAr: 'إنترنت وهاتف', nameEn: 'Internet and phone', monthlyAmount: 500, type: 'fixed', category: 'utilities' },
  { id: 'exp_emp_sal', nameAr: 'مرتبات العاملين (فريق التشغيل)', nameEn: 'Employee salaries', monthlyAmount: 30000, type: 'fixed', category: 'salaries' },
  { id: 'exp_owner_sal', nameAr: 'راتب صاحب العمل (المخصص)', nameEn: 'Owner salary', monthlyAmount: 10000, type: 'fixed', category: 'salaries' },
  { id: 'exp_transport', nameAr: 'انتقالات ونقل بضائع', nameEn: 'Transportation', monthlyAmount: 3000, type: 'fixed', category: 'operations' },
  { id: 'exp_meals', nameAr: 'وجبات ومشروبات العاملين', nameEn: 'Staff meals', monthlyAmount: 3000, type: 'fixed', category: 'operations' },
  { id: 'exp_cleaning', nameAr: 'أدوات نظافة ومطهرات', nameEn: 'Cleaning', monthlyAmount: 200, type: 'fixed', category: 'operations' },
  { id: 'exp_maintenance', nameAr: 'صيانة ماكينات وثلاجات دورية', nameEn: 'Maintenance', monthlyAmount: 1000, type: 'fixed', category: 'operations' },
  { id: 'exp_supplies', nameAr: 'مستلزمات تشغيلية أخرى', nameEn: 'Other operating supplies', monthlyAmount: 1000, type: 'fixed', category: 'operations' },
  { id: 'exp_ads', nameAr: 'دعاية وإعلانات افتتاح وتسويق', nameEn: 'Advertising', monthlyAmount: 2000, type: 'fixed', category: 'marketing' },
  { id: 'exp_delivery', nameAr: 'توصيل مدفوع من المحل', nameEn: 'Delivery paid by shop', monthlyAmount: 0, type: 'fixed', category: 'operations' },
  { id: 'exp_payment_fees', nameAr: 'رسوم دفع إلكتروني وبنك', nameEn: 'Payment fees', monthlyAmount: 1200, type: 'mixed', category: 'fees', notes: 'قابلة للضبط كثابتة أو متغيرة مع المبيعات' },
  { id: 'exp_other', nameAr: 'مصروفات أخرى طارئة', nameEn: 'Other expenses', monthlyAmount: 0, type: 'fixed', category: 'other' }
];

export const PLANNED_MONTHLY_BUDGET = 61050; // Sum of the above: exactly EGP 61,050

export const INITIAL_INVOICES: PurchaseInvoice[] = [
  {
    id: 'INV-20261011-001',
    invoiceNumber: 'فاتورة-101',
    invoiceDate: '2026-10-11',
    supplierName: 'معلم رجب — سوق العبور',
    status: 'approved',
    items: [
      {
        id: 'item_1',
        ingredientId: 'ing_orange',
        ingredientNameAr: 'برتقال بلدي',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 5,
        packageUnitName: 'قفص',
        totalWeightKg: 100,
        unitPrice: 20,
        totalCost: 2000,
        notes: 'برتقال صيفي عصير نمرة 1'
      },
      {
        id: 'item_2',
        ingredientId: 'ing_strawberry',
        ingredientNameAr: 'فراولة طازجة',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 2,
        packageUnitName: 'كرتونة',
        totalWeightKg: 40,
        unitPrice: 50,
        totalCost: 2000,
        notes: 'فراولة بلدي سكري'
      }
    ],
    totalAmount: 4000,
    totalWeightKg: 140,
    notes: 'توريد سوق العبور الصباحي — معتمد',
    createdAt: '2026-10-11T06:30:00Z',
    approvedAt: '2026-10-11T07:00:00Z'
  }
];

// ==========================================
// INITIAL CASHIERS & STAFF (2 Cashiers)
// ==========================================

export const INITIAL_CASHIERS: CashierAccount[] = [
  {
    id: 'csh_1',
    nameAr: 'أحمد محمود (كاشير 1)',
    username: 'ahmed_cashier',
    role: 'cashier',
    pinCode: '1111',
    active: true
  },
  {
    id: 'csh_2',
    nameAr: 'محمد علي (كاشير 2)',
    username: 'mohamed_cashier',
    role: 'cashier',
    pinCode: '2222',
    active: true
  },
  {
    id: 'mgr_admin',
    nameAr: 'المدير المسؤول — صاحب العمل',
    username: 'owner_admin',
    role: 'manager',
    pinCode: '1234',
    active: true
  }
];

export const DEFAULT_MANAGER_PIN = '1234';

// ==========================================
// INITIAL SHIFTS
// ==========================================

export const INITIAL_SHIFTS: CashierShift[] = [
  {
    id: 'shift_20261012_01',
    shiftNumber: 1,
    cashierId: 'csh_1',
    cashierName: 'أحمد محمود (كاشير 1)',
    startTime: '2026-10-12T08:00:00Z',
    status: 'open',
    openingFloat: 500, // Fixed EGP 500
    cashReceived: 620,
    cashDeposits: 0,
    cashRefunds: 0,
    cashExpenses: 0,
    cashWithdrawals: 0,
    expectedCash: 1120 // 500 + 620 = 1120 EGP
  }
];

// ==========================================
// INITIAL PAYMENT FEE RULES
// ==========================================

export const INITIAL_FEE_RULES: PaymentFeeRule[] = [
  {
    id: 'rule_bank_misr_pos',
    providerName: 'ماكينة بنك مصر (POS)',
    paymentMethod: 'card',
    feePercent: 1.5,
    fixedFee: 0,
    minFee: 2.0,
    maxFee: 150.0,
    contractualTaxPercent: 14, // 14% VAT on fee
    monthlyServiceFee: 150, // 150 EGP monthly rental
    effectiveStartDate: '2026-01-01',
    roundingRule: 'round_2_decimals',
    active: true,
    version: 1
  },
  {
    id: 'rule_fawry_pos',
    providerName: 'فوري بيمنتس (Fawry)',
    paymentMethod: 'card',
    feePercent: 1.8,
    fixedFee: 1.0,
    minFee: 2.5,
    effectiveStartDate: '2026-01-01',
    roundingRule: 'round_2_decimals',
    active: true,
    version: 1
  },
  {
    id: 'rule_instapay_business',
    providerName: 'شبكة المدفوعات اللحظية (InstaPay)',
    paymentMethod: 'instapay',
    feePercent: 0, // Free promo in Egyptian market / no percentage fee currently
    fixedFee: 0,
    effectiveStartDate: '2026-01-01',
    roundingRule: 'round_2_decimals',
    active: true,
    version: 1
  }
];

// ==========================================
// INITIAL PROMOTIONS
// ==========================================

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'promo_opening_10',
    nameAr: 'خصم الافتتاح 10%',
    type: 'percentage',
    value: 10,
    applicableProductIds: [],
    minOrderAmount: 100,
    requiresManagerApproval: false,
    active: true,
    notes: 'عرض الافتتاح لطلبات الصالة والتيك أواي فوق 100 جنيه'
  },
  {
    id: 'promo_combo_special',
    nameAr: 'عرض كومبو عصائر الفريش (خصم 20 ج)',
    type: 'fixed_amount',
    value: 20,
    applicableProductIds: ['prod_mango', 'prod_strawberry'],
    minOrderAmount: 120,
    requiresManagerApproval: false,
    active: true,
    notes: 'خصم ثابت عند طلب كوبين من فواكه الموسم'
  }
];

// ==========================================
// INITIAL ORDERS & PAYMENTS (DEMO SEED)
// ==========================================

export const INITIAL_ORDERS: PosOrder[] = [
  {
    id: 'ORD-20261012-001',
    orderNumber: 'ORD-101',
    orderType: 'takeaway',
    items: [
      {
        id: 'oi_1',
        productId: 'prod_mango',
        productNameAr: 'مانجو كينج نعومي',
        servingSize: '400ml',
        unitPrice: 50,
        quantity: 2,
        modifiers: { sugarLevel: 'standard', iceLevel: 'standard' },
        totalPrice: 100,
        isPrepared: true
      },
      {
        id: 'oi_2',
        productId: 'prod_strawberry',
        productNameAr: 'فراولة بلدي فريش',
        servingSize: '400ml',
        unitPrice: 40,
        quantity: 1,
        modifiers: { sugarLevel: 'low', iceLevel: 'light' },
        totalPrice: 40,
        isPrepared: true
      }
    ],
    subtotal: 140,
    discountAmount: 0,
    deliveryFee: 0,
    totalAmount: 140,
    orderStatus: 'completed',
    paymentStatus: 'paid',
    preparationStatus: 'ready',
    cashierId: 'csh_1',
    cashierName: 'أحمد محمود (كاشير 1)',
    shiftId: 'shift_20261012_01',
    customerName: 'كابتن طارق',
    createdAt: '2026-10-12T09:15:00Z',
    paidAt: '2026-10-12T09:16:00Z',
    preparedAt: '2026-10-12T09:20:00Z',
    completedAt: '2026-10-12T09:22:00Z',
    totalRefundedAmount: 0
  },
  {
    id: 'ORD-20261012-002',
    orderNumber: 'ORD-102',
    orderType: 'dine_in',
    items: [
      {
        id: 'oi_3',
        productId: 'prod_sobia',
        productNameAr: 'سوبيا فاخرة بجوز الهند',
        servingSize: '1L',
        unitPrice: 45,
        quantity: 2,
        modifiers: { sugarLevel: 'standard', iceLevel: 'standard' },
        totalPrice: 90,
        isPrepared: true
      }
    ],
    subtotal: 90,
    discountAmount: 0,
    deliveryFee: 0,
    totalAmount: 90,
    orderStatus: 'completed',
    paymentStatus: 'paid',
    preparationStatus: 'ready',
    cashierId: 'csh_1',
    cashierName: 'أحمد محمود (كاشير 1)',
    shiftId: 'shift_20261012_01',
    createdAt: '2026-10-12T09:30:00Z',
    paidAt: '2026-10-12T09:31:00Z',
    preparedAt: '2026-10-12T09:35:00Z',
    completedAt: '2026-10-12T09:38:00Z',
    totalRefundedAmount: 0
  }
];

export const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'PAY-20261012-001',
    orderId: 'ORD-20261012-001',
    orderNumber: 'ORD-101',
    amount: 140,
    method: 'cash',
    status: 'verified',
    timestamp: '2026-10-12T09:16:00Z',
    cashierId: 'csh_1',
    cashierShiftId: 'shift_20261012_01',
    amountTendered: 200,
    changeDue: 60,
    amountReceived: 140
  },
  {
    id: 'PAY-20261012-002',
    orderId: 'ORD-20261012-002',
    orderNumber: 'ORD-102',
    amount: 90,
    method: 'card',
    status: 'verified',
    timestamp: '2026-10-12T09:31:00Z',
    cashierId: 'csh_1',
    cashierShiftId: 'shift_20261012_01',
    terminalId: 'POS-BM-01',
    cardTransactionReference: 'TXN-98471203',
    cardType: 'visa',
    authorizationCode: 'AUTH-6541',
    feeSnapshot: {
      ruleId: 'rule_bank_misr_pos',
      providerName: 'ماكينة بنك مصر (POS)',
      feePercent: 1.5,
      fixedFee: 0,
      expectedFeeAmount: 2.0, // Minimum fee applied
      expectedNetSettlement: 88.0,
      reconciliationStatus: 'unreconciled'
    }
  }
];

export const INITIAL_APPROVALS: ManagerApprovalRequest[] = [];
export const INITIAL_REFUNDS: RefundRecord[] = [];


