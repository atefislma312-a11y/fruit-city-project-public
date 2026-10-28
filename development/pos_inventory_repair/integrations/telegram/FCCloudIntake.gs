/**
 * ============================================================================
 * FRUIT CITY — CLOUD INTAKE ENGINE (FCCloudIntake)
 * ============================================================================
 * الإصدار: 1.4.0
 * 
 * الميزات المعمارية:
 * 1. Namespace / IIFE مغلق: يمنع تلوث النطاق العام، ويسمح بالربط النظيف مع الرمز.gs.
 * 2. UTF-8 Byte Accounting: احتساب حدود التخزين بالبايت الحقيقي وليس طول السلسلة
 *    (8,500 بايت للسجل الواحد، وميزانية إجمالية 450,000 بايت لمنع تجاوز حدود Apps Script).
 * 3. Zero Data Loss: لا حذف لأي عنصر عند امتلاء السعة؛ رفض صريح بـ QUEUE_FULL.
 * 4. Stale Ack & Exact Revision Protection: اشتراط المطابقة الدقيقة للمراجعة
 *    وبصمة المحتوى السحابية (Exact Revision Equality).
 * 5. Cairo Date Prompt Injection: تزويد Gemini بسياق تاريخ اليوم والأمس بتوقيت
 *    القاهرة (Africa/Cairo) بناءً على ختم وقت رسالة تليجرام لتفسير "امبارح" و"النهارده" بدقة.
 * 6. Coherent Clarification Flow: إكمال وتعديل الفواتير الناقصة بتمرير المسودة السابقة
 *    مع الرسالة الواردة (نص، صوت، أو صورة) لنفس المستخرج الذكي، دون تعبيرات نمطية بدائية،
 *    مع الحفاظ على كود الفاتورة الأصلي، وضمان عدم دخول فواتير ناقصة المورد أو التاريخ للطابور.
 * 7. Clean Plain Arabic: رسائل التليجرام موجهة للمالك بلغة عربية نقية واضحة
 *    دون أي تسريب لمصطلحات داخلية مثل SQLite أو Checksum أو التجزئات الفنية.
 * ============================================================================
 */

var FCCloudIntake = (function() {
  'use strict';

  var MAX_RECORD_BYTES = 8500;
  var MAX_TOTAL_BYTES = 450000;
  var MAX_QUEUE_CAPACITY = 40;
  var QUEUE_KEYS_PROP = "FC_QUEUE_KEYS";
  var TOMBSTONES_PROP = "FC_PROCESSED_TOMBSTONES";

  function getEnv(key, defaultValue) {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty(key);
    return val ? val.trim() : (defaultValue || "");
  }

  function getUtf8ByteLength(str) {
    if (!str) return 0;
    if (typeof Utilities !== 'undefined' && Utilities.newBlob) {
      return Utilities.newBlob(str).getBytes().length;
    }
    var s = String(str);
    var bytes = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code <= 0x7f) {
        bytes += 1;
      } else if (code <= 0x7ff) {
        bytes += 2;
      } else if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  function jsonResponse(data, statusCode) {
    var out = ContentService.createTextOutput(JSON.stringify(data));
    out.setMimeType(ContentService.MimeType.JSON);
    return out;
  }

  function isValidFinitePositiveNumber(val) {
    if (val === null || val === undefined || typeof val === "boolean" || val === "") return false;
    var num = Number(val);
    return Number.isFinite(num) && num > 0;
  }

  function isValidFiniteNonNegativeNumber(val) {
    if (val === null || val === undefined || typeof val === "boolean" || val === "") return false;
    var num = Number(val);
    return Number.isFinite(num) && num >= 0;
  }

  function isValidPositiveInteger(val) {
    if (val === null || val === undefined || typeof val === "boolean" || val === "") return false;
    var num = Number(val);
    return Number.isInteger(num) && num > 0;
  }

  function isValidCalendarDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    var parts = dateStr.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === (m - 1) && dt.getDate() === d;
  }

  function getCairoDateContext(timestampSec) {
    var d = timestampSec ? new Date(timestampSec * 1000) : new Date();
    var cairoToday = "";
    var cairoYesterday = "";
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      cairoToday = Utilities.formatDate(d, "Africa/Cairo", "yyyy-MM-dd");
      var yst = new Date(d.getTime() - 24 * 60 * 60 * 1000);
      cairoYesterday = Utilities.formatDate(yst, "Africa/Cairo", "yyyy-MM-dd");
    } else {
      cairoToday = d.toISOString().split("T")[0];
      var yst2 = new Date(d.getTime() - 24 * 60 * 60 * 1000);
      cairoYesterday = yst2.toISOString().split("T")[0];
    }
    return { today: cairoToday, yesterday: cairoYesterday };
  }

  function computeCloudChecksum(invoiceObj) {
    var norm = {
      chat_id: invoiceObj.telegram_chat_id,
      msg_id: invoiceObj.telegram_message_id,
      revision: invoiceObj.revision || 1,
      supplier: invoiceObj.supplier_name || "",
      date: invoiceObj.invoice_date || "",
      total: invoiceObj.authoritative_total_amount || 0,
      weight: invoiceObj.total_weight_kg || 0,
      items: []
    };

    if (Array.isArray(invoiceObj.items)) {
      for (var i = 0; i < invoiceObj.items.length; i++) {
        var it = invoiceObj.items[i];
        norm.items.push({
          name: it.ingredient_name_ar,
          count: it.package_count,
          weight: it.total_weight_kg,
          price: it.unit_price,
          cost: it.authoritative_cost
        });
      }
    }

    var str = JSON.stringify(norm);
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
    var txtHash = "";
    for (var j = 0; j < rawHash.length; j++) {
      var b = (rawHash[j] < 0 ? rawHash[j] + 256 : rawHash[j]).toString(16);
      if (b.length === 1) b = "0" + b;
      txtHash += b;
    }
    return txtHash.substring(0, 16);
  }

  function getQueueKeyList() {
    var raw = PropertiesService.getScriptProperties().getProperty(QUEUE_KEYS_PROP) || "[]";
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveQueueKeyList(arr) {
    PropertiesService.getScriptProperties().setProperty(QUEUE_KEYS_PROP, JSON.stringify(arr));
  }

  function getTombstonesList() {
    var raw = PropertiesService.getScriptProperties().getProperty(TOMBSTONES_PROP) || "[]";
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function addTombstone(id) {
    var props = PropertiesService.getScriptProperties();
    var list = getTombstonesList();
    if (list.indexOf(id) === -1) {
      if (list.length >= 200) list.shift();
      list.push(id);
      props.setProperty(TOMBSTONES_PROP, JSON.stringify(list));
    }
  }

  function isNonceFreshAndRecord(nonce) {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty("FC_SEEN_NONCES") || "[]";
    var nonces = [];
    try { nonces = JSON.parse(raw); } catch (e) { nonces = []; }

    if (nonces.indexOf(nonce) !== -1) return false;
    if (nonces.length >= 100) nonces.shift();
    nonces.push(nonce);
    props.setProperty("FC_SEEN_NONCES", JSON.stringify(nonces));
    return true;
  }

  function enqueueInvoiceInternal(queueId, invoiceObj, isEdit) {
    var props = PropertiesService.getScriptProperties();
    var keys = getQueueKeyList();
    var tombstones = getTombstonesList();

    if (tombstones.indexOf(queueId) !== -1) {
      return { success: false, error: "ALREADY_COMMITTED" };
    }

    var existingIndex = keys.indexOf(queueId);

    if (existingIndex !== -1) {
      var oldRaw = props.getProperty("FC_ITEM_" + queueId);
      var oldObj = null;
      try { oldObj = JSON.parse(oldRaw); } catch (e) {}
      invoiceObj.revision = (oldObj && oldObj.revision) ? (oldObj.revision + 1) : 2;
    } else {
      invoiceObj.revision = invoiceObj.revision || 1;
    }

    invoiceObj.cloud_checksum = computeCloudChecksum(invoiceObj);
    var jsonStr = JSON.stringify(invoiceObj);
    var recordBytes = getUtf8ByteLength(jsonStr);

    if (recordBytes > MAX_RECORD_BYTES) {
      return { success: false, error: "RECORD_SIZE_EXCEEDED" };
    }

    if (existingIndex !== -1) {
      props.setProperty("FC_ITEM_" + queueId, jsonStr);
      return {
        success: true,
        updated: true,
        queue_id: queueId,
        revision: invoiceObj.revision,
        cloud_checksum: invoiceObj.cloud_checksum
      };
    }

    if (keys.length >= MAX_QUEUE_CAPACITY) {
      return { success: false, error: "QUEUE_FULL" };
    }

    var totalBytesEstimate = 0;
    for (var k = 0; k < keys.length; k++) {
      var rawK = props.getProperty("FC_ITEM_" + keys[k]);
      if (rawK) totalBytesEstimate += getUtf8ByteLength(rawK);
    }
    if (totalBytesEstimate + recordBytes > MAX_TOTAL_BYTES) {
      return { success: false, error: "QUEUE_FULL" };
    }

    keys.push(queueId);
    props.setProperty("FC_ITEM_" + queueId, jsonStr);
    saveQueueKeyList(keys);

    return {
      success: true,
      enqueued: true,
      queue_id: queueId,
      revision: invoiceObj.revision,
      cloud_checksum: invoiceObj.cloud_checksum
    };
  }

  function getPendingQueueItemsInternal() {
    var props = PropertiesService.getScriptProperties();
    var keys = getQueueKeyList();
    var items = [];

    for (var i = 0; i < keys.length; i++) {
      var rawItem = props.getProperty("FC_ITEM_" + keys[i]);
      if (rawItem) {
        try {
          var parsed = JSON.parse(rawItem);
          parsed.queue_id = keys[i];
          items.push(parsed);
        } catch (err) {}
      }
    }

    return { success: true, count: items.length, items: items };
  }

  function acknowledgeQueueItemInternal(queueId, localInvoiceId, localInvoiceNumber, revision, itemChecksum) {
    if (!queueId || revision === undefined || revision === null || !itemChecksum) {
      return { success: false, error: "MISSING_REVISION_OR_CHECKSUM", queue_id: queueId };
    }

    var props = PropertiesService.getScriptProperties();
    var keys = getQueueKeyList();
    var tombstones = getTombstonesList();

    var isQueued = (keys.indexOf(queueId) !== -1);
    var isTombstone = (tombstones.indexOf(queueId) !== -1);

    if (!isQueued && !isTombstone) {
      return { success: false, error: "UNKNOWN_QUEUE_ID", queue_id: queueId };
    }

    if (isTombstone && !isQueued) {
      return { success: true, already_acknowledged: true, queue_id: queueId };
    }

    var rawItem = props.getProperty("FC_ITEM_" + queueId);
    if (!rawItem) {
      return { success: false, error: "CORRUPTED_QUEUE_ITEM", queue_id: queueId };
    }

    var currentItem = null;
    try { currentItem = JSON.parse(rawItem); } catch (e) {}
    if (!currentItem) {
      return { success: false, error: "CORRUPTED_QUEUE_ITEM", queue_id: queueId };
    }

    // Exact Revision Equality Check
    if (Number(revision) !== Number(currentItem.revision || 1)) {
      return {
        success: false,
        error: "STALE_REVISION",
        queue_id: queueId,
        ack_revision: revision,
        current_revision: currentItem.revision
      };
    }

    // Exact Cloud Checksum Check
    if (itemChecksum !== currentItem.cloud_checksum) {
      return {
        success: false,
        error: "STALE_CHECKSUM",
        queue_id: queueId,
        ack_checksum: itemChecksum,
        current_checksum: currentItem.cloud_checksum
      };
    }

    var index = keys.indexOf(queueId);
    if (index !== -1) {
      keys.splice(index, 1);
      saveQueueKeyList(keys);
    }
    props.deleteProperty("FC_ITEM_" + queueId);
    addTombstone(queueId);

    // إشعار المالك على تليجرام بلغة عربية نظيفة خالية من المصطلحات التقنية
    if (currentItem && currentItem.telegram_chat_id) {
      var ackMsg = "✅ تم تسجيل الفاتورة في سيستم Fruit City.\n\n" +
        "📄 رقم الفاتورة: " + (localInvoiceNumber || "INV-DRAFT") + "\n" +
        "💰 الإجمالي: " + (currentItem.authoritative_total_amount || 0) + " ج.م\n" +
        "📋 الحالة: مسودة جاهزة للمراجعة والاعتماد على الجهاز.";
      sendTelegram(currentItem.telegram_chat_id, ackMsg);
    }

    return {
      success: true,
      acknowledged: queueId,
      localInvoiceId: localInvoiceId,
      revision: currentItem.revision,
      cloud_checksum: currentItem.cloud_checksum
    };
  }

  function validateAndCalculateInvoice(invoice) {
    var missing = [];
    var items = Array.isArray(invoice.items) ? invoice.items : [];

    if (items.length === 0) {
      return { status: "incomplete", missing_fields: ["بنود الفاتورة (الأصناف والكميات)"] };
    }

    // اسم المورد إلزامي ولا يجوز اعتماد قيم وهمية
    if (!invoice.supplier_name || typeof invoice.supplier_name !== "string" || invoice.supplier_name.trim().length === 0) {
      missing.push("اسم المورد");
    }

    // تاريخ الفاتورة إلزامي ويجب أن يكون تاريخاً حقيقياً في التقويم YYYY-MM-DD
    if (!invoice.invoice_date || typeof invoice.invoice_date !== "string" || !isValidCalendarDate(invoice.invoice_date.trim())) {
      missing.push("تاريخ الفاتورة (YYYY-MM-DD)");
    }

    var validMethods = ["by_weight", "by_package", "by_piece"];
    var authoritativeTotal = 0;
    var totalWeight = 0;
    var totalFee = 0;

    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var itemPrefix = (itm.ingredient_name_ar && typeof itm.ingredient_name_ar === "string")
        ? itm.ingredient_name_ar.trim()
        : ("بند " + (i + 1));

      if (!itm.ingredient_name_ar || typeof itm.ingredient_name_ar !== "string" || itm.ingredient_name_ar.trim().length === 0) {
        missing.push("اسم الصنف للبند رقم " + (i + 1));
      }

      var method = itm.pricing_method || "by_weight";
      if (validMethods.indexOf(method) === -1) {
        missing.push("طريقة التسعير لـ (" + itemPrefix + ")");
      }

      if (!isValidPositiveInteger(itm.package_count)) {
        missing.push("عدد العبوات لـ (" + itemPrefix + ")");
      }

      if (!isValidFinitePositiveNumber(itm.unit_price)) {
        missing.push("سعر الكيلو أو العبوة لـ (" + itemPrefix + ")");
      }

      if (method === "by_weight") {
        if (!isValidFinitePositiveNumber(itm.total_weight_kg)) {
          missing.push("الوزن الإجمالي الصافي بالكيلو لـ (" + itemPrefix + ")");
        }
      }

      if (itm.stated_item_cost !== undefined && itm.stated_item_cost !== null) {
        if (!isValidFiniteNonNegativeNumber(itm.stated_item_cost)) {
          missing.push("إجمالي البند المذكور لـ (" + itemPrefix + ")");
        }
      }

      if (missing.length > 0) continue;

      var pkgCount = Number(itm.package_count);
      var unitPrice = Number(itm.unit_price);
      itm.package_fee_per_unit = 10.00;
      itm.total_package_fee = pkgCount * 10.00;
      totalFee += itm.total_package_fee;

      var itemCost = 0;
      if (method === "by_weight") {
        var w = Number(itm.total_weight_kg);
        totalWeight += w;
        itemCost = Math.round(((w * unitPrice) + itm.total_package_fee) * 100) / 100;
      } else {
        itemCost = Math.round(((pkgCount * unitPrice) + itm.total_package_fee) * 100) / 100;
      }
      itm.authoritative_cost = itemCost;
      authoritativeTotal += itemCost;
    }

    if (missing.length > 0) {
      return { status: "incomplete", missing_fields: missing };
    }

    authoritativeTotal = Math.round(authoritativeTotal * 100) / 100;
    totalWeight = Math.round(totalWeight * 1000) / 1000;

    // فحص الإجمالي المذكور إن وُجد فقط (لا يشترط وجوده، وتُعتمد الحسبة التلقائية للأرقام الصريحة)
    var statedTotal = null;
    if (invoice.stated_total_amount !== undefined && invoice.stated_total_amount !== null && invoice.stated_total_amount !== "") {
      if (!isValidFiniteNonNegativeNumber(invoice.stated_total_amount)) {
        return { status: "incomplete", missing_fields: ["الإجمالي المالي المذكور غير صالح"] };
      }
      statedTotal = Number(invoice.stated_total_amount);
    }

    if (statedTotal !== null && Math.abs(statedTotal - authoritativeTotal) > 0.05) {
      return {
        status: "discrepancy",
        stated_total: statedTotal,
        authoritative_total: authoritativeTotal,
        discrepancy: Math.round((statedTotal - authoritativeTotal) * 100) / 100,
        total_weight: totalWeight,
        total_fee: totalFee
      };
    }

    return {
      status: "valid",
      authoritative_total: authoritativeTotal,
      stated_total: statedTotal,
      total_weight: totalWeight,
      total_fee: totalFee
    };
  }

  function handleTelegramMessage(msg, updateId, isEdit) {
    var chat = msg.chat;
    var from = msg.from;
    var text = (msg.text || msg.caption || "").trim();

    if (!chat || chat.type !== "private") return;

    var chatId = chat.id;
    var fromId = from ? from.id : null;

    // مسار أمر /myid: متاح لأي مستخدم في الخاص لاستخراج معرفه الرقمي فقط
    if (text === "/myid") {
      var idInfo = "معرف حسابك في تليجرام:\n" + fromId + "\n\n(هذا الرقم مخصص لربط صلاحيات المالك في إعدادات النظام).";
      sendTelegram(chatId, idInfo);
      return;
    }

    var configuredOwnerId = getEnv("OWNER_TELEGRAM_ID");
    if (!configuredOwnerId || !fromId || String(fromId).trim() !== String(configuredOwnerId).trim()) {
      sendTelegram(chatId, "⚠️ عذراً، هذا البوت مخصص لإدارة فواتير المشتريات وغير متاح للمستخدمين غير المصرح لهم.");
      return;
    }

    var messageId = msg.message_id;

    if (text === "/start") {
      sendTelegram(chatId, "أهلاً بك يا حاج إسلام في قناة الإدخال السحابية لفروت سيتي! 🍎🥤\n\nأرسل رسالة نصية أو تسجيل صوتي أو صورة فاتورة مشتريات لتجهيزها في قائمة الانتظار.");
      return;
    }

    // سياق الفاتورة المعلقة قيد الاستكمال
    var clarificationContext = (!isEdit) ? getClarificationContext(chatId) : null;
    var existingDraft = clarificationContext ? clarificationContext.partial_draft : null;
    var targetMsgAnchor = clarificationContext ? (clarificationContext.pending_message_id || messageId) : messageId;

    var audioPart = null;
    if (msg.voice) {
      audioPart = downloadTelegramMediaSafe(msg.voice.file_id, "audio/ogg");
    } else if (msg.audio) {
      audioPart = downloadTelegramMediaSafe(msg.audio.file_id, msg.audio.mime_type || "audio/mpeg");
    }

    var imagePart = null;
    if (msg.photo && msg.photo.length > 0) {
      var largestPhoto = msg.photo[msg.photo.length - 1];
      imagePart = downloadTelegramMediaSafe(largestPhoto.file_id, "image/jpeg");
    }

    // استدعاء المستخرج الذكي مع المسودة السابقة وختم وقت رسالة تليجرام المعتمد
    var msgTimestamp = msg.date || Math.floor(Date.now() / 1000);
    var extracted = callGeminiInvoiceParser(text, audioPart, imagePart, existingDraft, msgTimestamp);

    if (!extracted || !extracted.items || extracted.items.length === 0) {
      if (!clarificationContext) {
        sendTelegram(chatId, "⚠️ تعذر استخراج بنود الفاتورة.\nيرجى تحديد: الصنف، عدد العبوات، الوزن الصافي، وسعر الكيلو، والمورد والتاريخ.\nمثال: كرتونة تفاح وزن 15 كيلو بسعر 50 جنيه للكيلو بيعة 10 مورد سوق العبور تاريخ النهارده.");
      } else {
        sendTelegram(chatId, "⚠️ لم نتمكن من فهم التوضيح.\nيرجى إرسال الحقل المطلوب صوتياً أو كتابةً لإكمال الفاتورة رقم #" + targetMsgAnchor + ".");
      }
      return;
    }

    var validation = validateAndCalculateInvoice(extracted);
    var queueId = "tg_msg_" + chatId + "_" + targetMsgAnchor;

    if (validation.status === "incomplete") {
      saveClarificationContext(chatId, {
        chat_id: chatId,
        pending_message_id: targetMsgAnchor,
        partial_draft: extracted,
        missing_fields: validation.missing_fields,
        created_at: new Date().toISOString()
      });

      sendTelegram(chatId, "⚠️ مسودة غير مكتملة (#" + targetMsgAnchor + "):\n\n" +
        "📌 الحقول المطلوبة: " + validation.missing_fields.join("، ") + "\n\n" +
        "يرجى إرسال " + validation.missing_fields[0] + " الآن لإكمال الفاتورة.");
      return;
    }

    if (validation.status === "discrepancy") {
      saveClarificationContext(chatId, {
        chat_id: chatId,
        pending_message_id: targetMsgAnchor,
        partial_draft: extracted,
        discrepancy: validation.discrepancy,
        missing_fields: ["تأكيد الفرق الحسابي"],
        created_at: new Date().toISOString()
      });

      sendTelegram(chatId, "⚠️ تنبيه فرق حسابي (#" + targetMsgAnchor + "):\n\n" +
        "• الإجمالي المذكور: " + validation.stated_total + " ج.م\n" +
        "• الإجمالي المحسوب: " + validation.authoritative_total + " ج.م\n" +
        "• الفارق: " + validation.discrepancy + " ج.م\n\n" +
        "يرجى كتابة الرقم المعتمد لتأكيد الفاتورة.");
      return;
    }

    // الفاتورة مكتملة ومحققة بالكامل: إدراجها بالطابور الجاهز مع تثبيت معرف الرسالة الأصلية
    var completeInvoice = extracted;
    completeInvoice.idempotency_key = queueId;
    completeInvoice.source = "telegram";
    completeInvoice.telegram_message_id = targetMsgAnchor;
    completeInvoice.telegram_chat_id = chatId;
    completeInvoice.telegram_sender_id = msg.from.id;
    completeInvoice.revision = isEdit ? 2 : 1;
    completeInvoice.authoritative_total_amount = validation.authoritative_total;
    completeInvoice.stated_total_amount = validation.stated_total; // null إذا لم يُذكر إجمالي صريح
    completeInvoice.total_weight_kg = validation.total_weight;
    completeInvoice.status = "draft";
    completeInvoice.received_at = new Date().toISOString();

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      sendTelegram(chatId, "⚠️ تعذر حجز قفل الطابور حالياً. يرجى إعادة المحاولة.");
      return;
    }

    var enqueueRes;
    try {
      enqueueRes = enqueueInvoiceInternal(queueId, completeInvoice, isEdit);
    } finally {
      lock.releaseLock();
    }

    if (!enqueueRes.success) {
      if (enqueueRes.error === "QUEUE_FULL") {
        sendTelegram(chatId, "⚠️ قائمة الانتظار ممتلئة حالياً.\nيرجى فتح النظام على الجهاز لاستقبال الفواتير المعلقة أولاً.");
      } else if (enqueueRes.error === "ALREADY_COMMITTED") {
        sendTelegram(chatId, "⚠️ هذه الفاتورة تم حفظها وتأكيدها بالفعل في النظام المحلي، ولا يمكن تعديلها من تليجرام.");
      } else {
        sendTelegram(chatId, "⚠️ تعذر إدراج الفاتورة في قائمة الانتظار (" + (enqueueRes.error || "خطأ") + ").");
      }
      return;
    }

    clearClarificationContext(chatId);

    var itmSummary = [];
    for (var k = 0; k < completeInvoice.items.length; k++) {
      var itm = completeInvoice.items[k];
      itmSummary.push("• " + itm.ingredient_name_ar + " (" + itm.package_count + " " + (itm.package_unit_name || "عبوة") + "): " +
        (itm.total_weight_kg ? itm.total_weight_kg + " كجم × " + itm.unit_price + " ج.م" : itm.package_count + " عبوة × " + itm.unit_price + " ج.م") +
        " + بيعة " + itm.total_package_fee + " ج.م = " + itm.authoritative_cost + " ج.م");
    }

    var msgTitle = isEdit ? "✏️ تم تعديل الفاتورة في قائمة الانتظار" : "✅ تم استلام الفاتورة وحفظها في الانتظار.";
    var replyText = msgTitle + " (#" + targetMsgAnchor + ")\n\n" +
      itmSummary.join("\n") + "\n\n" +
      "💰 الإجمالي المحسوب: " + completeInvoice.authoritative_total_amount + " ج.م\n" +
      "🏷️ المورد: " + completeInvoice.supplier_name + "\n" +
      "📅 التاريخ: " + completeInvoice.invoice_date + "\n" +
      "\n⏳ سيتم تسجيل الفاتورة في سيستم Fruit City تلقائياً عند فتح الجهاز.";

    sendTelegram(chatId, replyText);
  }

  function getClarificationContext(chatId) {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty("FC_PENDING_CLARIFICATION_" + chatId);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function saveClarificationContext(chatId, context) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty("FC_PENDING_CLARIFICATION_" + chatId, JSON.stringify(context));
  }

  function clearClarificationContext(chatId) {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty("FC_PENDING_CLARIFICATION_" + chatId);
  }

  function handleFacebook(event) {
    var senderId = event.sender ? event.sender.id : null;
    var messageText = event.message ? event.message.text : "";
    if (messageText && senderId) {
      var reply = callGeminiCustomerService(messageText);
      // إرسال الرد للعميل على فيسبوك
    }
  }

  function callGeminiCustomerService(userPrompt) {
    var geminiKey = getEnv("GEMINI_KEY");
    if (!geminiKey) return "أهلاً بك في فروت سيتي! نسعد بخدمتك دائماً.";

    var model = getEnv("GEMINI_MODEL", "gemini-2.5-flash");
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiKey;
    var systemPrompt = "أنت موظف خدمة العملاء الذكي لمحل عصائر وفواكه «فروت سيتي» (Fruit City). رد بأسلوب مصري ودود ومحترف وسريع، وقدم المساعدة للزبائن في معرفة المنيو والأسعار ومواعيد العمل.";
    var payload = {
      contents: [{ parts: [{ text: systemPrompt + "\n\nرسالة الزبون: " + userPrompt }] }]
    };
    try {
      var res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() !== 200) return "أهلاً بك في فروت سيتي! كيف يمكننا مساعدتك اليوم؟";
      var json = JSON.parse(res.getContentText());
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
        return json.candidates[0].content.parts[0].text;
      }
    } catch (e) {}
    return "أهلاً بك في فروت سيتي! كيف يمكننا مساعدتك اليوم؟";
  }

  function downloadTelegramMediaSafe(fileId, mimeType) {
    var botToken = getEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken || !fileId) return null;

    try {
      var getFileUrl = "https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + fileId;
      var res = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return null;

      var json = JSON.parse(res.getContentText());
      if (!json.ok || !json.result || !json.result.file_path) return null;

      var downloadUrl = "https://api.telegram.org/file/bot" + botToken + "/" + json.result.file_path;
      var fileRes = UrlFetchApp.fetch(downloadUrl, { muteHttpExceptions: true });
      if (fileRes.getResponseCode() !== 200) return null;

      var blob = fileRes.getBlob();
      var bytes = blob.getBytes();
      if (!bytes || bytes.length === 0) return null;

      return {
        mimeType: mimeType || blob.getContentType(),
        data: Utilities.base64Encode(bytes)
      };
    } catch (e) {
      return null;
    }
  }

  function callGeminiInvoiceParser(userText, audioPart, imagePart, existingDraft, msgTimestampSec) {
    var geminiKey = getEnv("GEMINI_KEY");
    if (!geminiKey) return null;

    var model = getEnv("GEMINI_MODEL", "gemini-2.5-flash");
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiKey;

    var cairoDates = getCairoDateContext(msgTimestampSec);

    var systemInstruction =
      "أنت محاسب فواتير لمحل عصائر وفواكه مصري «فروت سيتي».\n" +
      "استخرج بيانات فاتورة المشتريات من النص أو الصوت المصري أو صورة الفاتورة وإرجاعها كـ JSON صالح حصراً.\n\n" +
      "سياق التاريخ بتوقيت القاهرة (Africa/Cairo) بناءً على وقت إرسال الرسالة:\n" +
      "- تاريخ اليوم (النهارده): " + cairoDates.today + "\n" +
      "- تاريخ الأمس (امبارح): " + cairoDates.yesterday + "\n" +
      "إذا ذكر المستخدم 'النهارده' أو اليوم، اجعل invoice_date = '" + cairoDates.today + "'. وإذا ذكر 'امبارح' أو أمس، اجعل invoice_date = '" + cairoDates.yesterday + "'. إذا حدد تاريخاً صريحاً بالتقويم (مثل 16-10 أو 2026-10-16 أو بأرقام عربية) حوله إلى صيغة YYYY-MM-DD وتأكد أنه تاريخ حقيقي في التقويم.\n\n" +
      "قواعد صارمة:\n" +
      "1. لا تخترع أو تخمن أو تفترض قيماً للحقول المفقودة (إذا لم يذكر الوزن اجعل total_weight_kg = null، إذا لم يذكر السعر اجعل unit_price = null، إذا لم يذكر عدد العبوات اجعل package_count = null، إذا لم يذكر المورد اجعل supplier_name = null، إذا لم يذكر التاريخ اجعل invoice_date = null).\n" +
      "2. استخرج الإجمالي المالي المذكور في الرسالة شفهياً أو نصياً وضعه في stated_total_amount. إذا لم يذكر إجمالياً صريحاً اجعل stated_total_amount = null.\n" +
      "3. أسماء وحدات العبوات المصرية: كرتونة، قفص، شيكارة، صندوق، سباطة، رابطة.\n\n";

    if (existingDraft) {
      systemInstruction +=
        "تنبيه هام (استكمال مسودة سابقة):\n" +
        "هناك مسودة فاتورة سابقة قيد الاستكمال: " + JSON.stringify(existingDraft) + "\n" +
        "المطلوب حصراً: دمج وتحديث الحقول المذكورة في هذه الرسالة الجديدة (سواء كانت نصاً أو تسجيلاً صوتياً أو صورة) مع الاحتفاظ بكافة الحقول والبيانات السابقة كما هي دون حذف أو تصفير.\n" +
        "- إذا كان التعديل أو التوضيح يخص التاريخ فقط، حدث تاريخ الفاتورة فقط ولا تغير الوزن أو السعر.\n" +
        "- إذا كان التوضيح يخص الوزن فقط، حدث وزن الصنف المقصود فقط ولا تغير التاريخ.\n" +
        "- إذا وردت أرقام بالعربية (مثل ١٥ أو ٥٠) افهمها واستخرجها بدقة.\n\n";
    }

    systemInstruction +=
      "تنسيق JSON المطلوب حصراً:\n" +
      "{\n" +
      "  \"supplier_name\": \"سوق العبور أو null\",\n" +
      "  \"invoice_date\": \"YYYY-MM-DD أو null\",\n" +
      "  \"stated_total_amount\": 805.0,\n" +
      "  \"items\": [\n" +
      "    {\n" +
      "      \"ingredient_name_ar\": \"تفاح\",\n" +
      "      \"pricing_method\": \"by_weight\",\n" +
      "      \"package_count\": 1,\n" +
      "      \"package_unit_name\": \"كرتونة\",\n" +
      "      \"total_weight_kg\": 15.0,\n" +
      "      \"unit_price\": 53.0,\n" +
      "      \"stated_item_cost\": 805.0,\n" +
      "      \"notes\": \"\"\n" +
      "    }\n" +
      "  ]\n" +
      "}";

    var parts = [{ text: systemInstruction }];
    if (userText) parts.push({ text: "مدخل المالك: " + userText });
    if (audioPart) {
      parts.push({ inlineData: { mimeType: audioPart.mimeType, data: audioPart.data } });
      parts.push({ text: "قم بتفريغ التسجيل الصوتي باللهجة المصرية واستخرج تفاصيل الفاتورة." });
    }
    if (imagePart) {
      parts.push({ inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } });
      parts.push({ text: "استخرج تفاصيل الفاتورة من الصورة." });
    }

    var payload = {
      contents: [{ parts: parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    try {
      var res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() !== 200) return null;

      var json = JSON.parse(res.getContentText());
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
        var raw = json.candidates[0].content.parts[0].text;
        var cleanJson = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        return JSON.parse(cleanJson);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  function sendTelegram(chatId, text) {
    var botToken = getEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken || !chatId) return;

    try {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          chat_id: chatId,
          text: text
        }),
        muteHttpExceptions: true
      });
    } catch (e) {}
  }

  function handleWorkerOperation(data) {
    var configuredWorkerToken = getEnv("WORKER_SECRET_TOKEN");
    if (!configuredWorkerToken || data.worker_token !== configuredWorkerToken) {
      return jsonResponse({ error: "UNAUTHORIZED", code: "E_INVALID_WORKER_TOKEN" }, 401);
    }

    var nowSec = Math.floor(Date.now() / 1000);
    var reqTimestamp = Number(data.timestamp || 0);
    if (!reqTimestamp || Math.abs(nowSec - reqTimestamp) > 300) {
      return jsonResponse({ error: "FORBIDDEN", code: "E_TIMESTAMP_OUT_OF_BOUNDS" }, 403);
    }

    var nonce = data.nonce ? String(data.nonce).trim() : "";
    if (!nonce || !isNonceFreshAndRecord(nonce)) {
      return jsonResponse({ error: "FORBIDDEN", code: "E_REPLAYED_NONCE" }, 403);
    }

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      return jsonResponse({ error: "SERVICE_UNAVAILABLE", code: "E_LOCK_TIMEOUT" }, 503);
    }

    try {
      if (data.action === "worker_poll") {
        var pending = getPendingQueueItemsInternal();
        return jsonResponse(pending, 200);
      }

      if (data.action === "worker_ack") {
        if (!data.queue_id || !data.invoice_id || data.revision === undefined || data.revision === null || !data.item_checksum) {
          return jsonResponse({ error: "BAD_REQUEST", code: "E_MISSING_ACK_PARAMS" }, 400);
        }
        var ackResult = acknowledgeQueueItemInternal(data.queue_id, data.invoice_id, data.invoice_number, data.revision, data.item_checksum);
        return jsonResponse(ackResult, ackResult.success ? 200 : 409);
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ error: "BAD_REQUEST", code: "E_UNKNOWN_ACTION" }, 400);
  }

  function doGet(e) {
    var params = (e && e.parameter) ? e.parameter : {};

    var fbVerifyToken = getEnv("FB_VERIFY_TOKEN");
    if (params["hub.mode"] === "subscribe" && params["hub.verify_token"] === fbVerifyToken) {
      return ContentService.createTextOutput(params["hub.challenge"] || "");
    }

    if (params.action === "worker_poll" || params.action === "worker_ack") {
      return jsonResponse({
        error: "METHOD_NOT_ALLOWED",
        code: "E_WORKER_GET_FORBIDDEN",
        message: "Worker poll and ack are restricted to authenticated POST requests only."
      }, 405);
    }

    return ContentService.createTextOutput("Fruit City Webhook is Active 24/7!");
  }

  function doPost(e) {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: "BAD_REQUEST", code: "E_EMPTY_BODY" }, 400);
    }

    var data = null;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ error: "BAD_REQUEST", code: "E_INVALID_JSON" }, 400);
    }

    try {
      // مسار استطلاع وتأكيد العامل المحلي
      if (data && (data.action === "worker_poll" || data.action === "worker_ack")) {
        return handleWorkerOperation(data);
      }

      // مسار تليجرام
      if (data && (data.message || data.edited_message)) {
        var webhookSecret = getEnv("TELEGRAM_WEBHOOK_SECRET");
        if (!webhookSecret) {
          return jsonResponse({ error: "FORBIDDEN", code: "E_WEBHOOK_NOT_CONFIGURED" }, 403);
        }

        var providedSecret = (e && e.parameter) ? e.parameter.secret : null;
        if (!providedSecret || providedSecret !== webhookSecret) {
          return jsonResponse({ error: "FORBIDDEN", code: "E_ORIGIN_SECRET_MISMATCH" }, 403);
        }

        var msg = data.message || data.edited_message;
        var isEdit = Boolean(data.edited_message);
        var updateId = data.update_id;

        if (!updateId || !msg || !msg.message_id) {
          return jsonResponse({ error: "BAD_REQUEST", code: "E_MISSING_UPDATE_IDS" }, 400);
        }

        handleTelegramMessage(msg, updateId, isEdit);
        return jsonResponse({ success: true, handled: "telegram" }, 200);
      }

      // مسار فيسبوك
      if (data && data.entry && data.entry[0] && data.entry[0].messaging) {
        handleFacebook(data.entry[0].messaging[0]);
        return jsonResponse({ success: true, handled: "facebook" }, 200);
      }

      return jsonResponse({ success: true, note: "Unrecognized payload source" }, 200);
    } catch (err) {
      return jsonResponse({ error: "INTERNAL_ERROR", code: "E_DISPATCH_FAIL" }, 500);
    }
  }

  return {
    doGet: doGet,
    doPost: doPost,
    handleTelegramMessage: handleTelegramMessage,
    handleFacebook: handleFacebook,
    handleWorkerOperation: handleWorkerOperation,
    enqueueInvoiceInternal: enqueueInvoiceInternal,
    acknowledgeQueueItemInternal: acknowledgeQueueItemInternal,
    getPendingQueueItemsInternal: getPendingQueueItemsInternal,
    validateAndCalculateInvoice: validateAndCalculateInvoice,
    computeCloudChecksum: computeCloudChecksum,
    getUtf8ByteLength: getUtf8ByteLength,
    isValidFinitePositiveNumber: isValidFinitePositiveNumber,
    isValidPositiveInteger: isValidPositiveInteger,
    getCairoDateContext: getCairoDateContext,
    getClarificationContext: getClarificationContext,
    isNonceFreshAndRecord: isNonceFreshAndRecord
  };
})();
