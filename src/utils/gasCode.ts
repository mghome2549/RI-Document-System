export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script (Code.gs) - ระบบเชื่อมต่อฐานข้อมูลอาจารย์สำหรับ RI Document System
 * 
 * วิธีการติดตั้ง:
 * 1. เปิด Google Sheets ขึ้นมา แล้วตั้งชื่อแท็บฐานข้อมูลใหม่ว่า "Database"
 * 2. แถวแรก (Row 1) ให้ใส่หัวคอลัมน์ดังนี้:
 *    [ คอลัมน์ A: ID | คอลัมน์ B: ชื่อ-นามสกุล | คอลัมน์ C: รหัสบุคลากร | คอลัมน์ D: ตำแหน่ง | คอลัมน์ E: หน่วยงาน | คอลัมน์ F: อีเมล์ | คอลัมน์ G: โทรศัพท์ ]
 * 3. ไปที่เมนู ส่วนขยาย (Extensions) -> App Script (Google Apps Script)
 * 4. ลบโค้ดเดิมออกทั้งหมด และคัดลอกโค้ดชุดนี้ไปวางแทนที่
 * 5. กด บันทึกโครงการ (Save Project)
 * 6. กดปุ่ม การใช้งานจริง (Deploy) -> การจัดการการใช้งานใหม่ (New Deployment)
 * 7. เลือกประเภทเป็น "เว็บแอป (Web App)" 
 *    - อัปเดตคำอธิบายตามชอบ
 *    - ช่อง "ผู้มีสิทธิ์เข้าถึง" ให้ตั้งเป็น "ทุกคน (Anyone)"
 * 8. กด การใช้งานจริง (Deploy) แล้วคัดลอกเว็บแอป URL (Web App URL) มาวางในช่องระบบตั้งค่าหน้าบ้าน React
 */

// 📊 ลิงก์แบบฟอร์มประเมินความพึงพอใจ Google Form เพียงลิงก์เดียวที่ใช้เทคนิค Pre-filled Link (กรอกข้อมูลล่วงหน้า)
// วิธีค้นหาและใช้ลิงก์นี้จาก Google Form ของคุณ:
// 1. เปิดฟอร์มประเมินความพึงพอใจของคุณใน Google Forms
// 2. กดที่ปุ่ม "จุดสามจุด" (มุมขวาบน) -> เลือก "รับลิงก์ที่กรอกไว้ล่วงหน้า" (Get pre-filled link)
// 3. กรอกคะแนนจำลอง (เช่น กรอก "5" ในข้อคะแนนดาว) แล้วกดปุ่ม "รับลิงก์" (Get link) ด้านล่างสุด
// 4. กด "คัดลอกลิงก์" แล้วนำมาวางแทนที่ลิงก์ตัวอย่างด้านล่างนี้ โดยให้ลบเลข 5 ตรงท้ายออก ให้เหลือแค่เครื่องหมาย "=" เท่านี้ระบบจะเติมคะแนนดาว 1-5 อัตโนมัติเมื่อคณาจารย์กดเลือกจากปุ่มในอีเมล!
var baseFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLScC1-b7U5n-Y8_uE9uX8j-b1S2u3Y4T5G6H7I8J9K0L/viewform?usp=pp_url&entry.11111=";

// เปิดสิทธิ์ CORS ให้การส่งข้อมูลแบบ JSON
function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชัน doGet(e) สำหรับดึงข้อมูลรายชื่ออาจารย์ทั้งหมดจาก Google Sheets แท็บ "Database"
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Database");
    
    // หากไม่พบหน้าแท็บชื่อ "Database" ให้สร้างขึ้นมาใหม่อัตโนมัติพร้อมหัวข้อคอลัมน์
    if (!sheet) {
      sheet = ss.insertSheet("Database");
      sheet.appendRow(["ID", "ชื่อ-นามสกุล", "รหัสบุคลากร", "ตำแหน่ง", "หน่วยงาน", "อีเมล์", "โทรศัพท์"]);
      
      // เพิ่มข้อมูลตัวอย่างเริ่มต้น
      sheet.appendRow(["prof-1", "ดร.พณพงศ์ สงสุทธะวัลย์", "10203040", "อาจารย์ประจำ", "สายวิจัยและพัฒนานวัตกรรมการศึกษา", "kittiwat.p@bu.ac.th", "02-123-4567"]);
      sheet.appendRow(["prof-2", "อ.กิตติวัฒน์ โพธิ์งามบวรชัย", "10203041", "อาจารย์ประจำ", "สายวิจัยและพัฒนานวัตกรรมการศึกษา", "kittiwat.p@bu.ac.th", "02-123-4568"]);
    }
    
    var lastRow = sheet.getLastRow();
    var data = [];
    
    if (lastRow > 1) {
      var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (var i = 0; i < values.length; i++) {
        data.push({
          id: values[i][0] ? values[i][0].toString() : "",
          name: values[i][1] ? values[i][1].toString() : "",
          personalId: values[i][2] ? values[i][2].toString() : "",
          position: values[i][3] ? values[i][3].toString() : "",
          department: values[i][4] ? values[i][4].toString() : "",
          email: values[i][5] ? values[i][5].toString() : "",
          phone: values[i][6] ? values[i][6].toString() : ""
        });
      }
    }
    
    return responseJson({
      status: "success",
      message: "ดึงข้อมูลสำเร็จ",
      data: data
    });
  } catch (error) {
    return responseJson({
      status: "error",
      message: "เกิดข้อผิดพลาด: " + error.toString()
    });
  }
}

/**
 * ฟังก์ชัน doPost(e) สำหรับรับคำสั่ง เพิ่ม, แก้ไข, ลบ และนำเข้า CSV ข้อมูลอาจารย์ใน Google Sheets รวมถึงการส่งอีเมลแจ้งผลพิจารณา
 */
function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action;
    
    // 📧 ประจุความต้องการแจ้งเมลแจ้งผลพิจารณาและแบบประเมินความพึงพอใจ
    if (action === "SEND_EMAIL" || (!action && payload.recipientEmail)) {
      var emailResult = sendAssessmentEmail(payload);
      return responseJson(emailResult);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Database");
    
    if (!sheet) {
      sheet = ss.insertSheet("Database");
      sheet.appendRow(["ID", "ชื่อ-นามสกุล", "รหัสบุคลากร", "ตำแหน่ง", "หน่วยงาน", "อีเมล์", "โทรศัพท์"]);
    }
    
    var lastRow = sheet.getLastRow();
    
    if (action === "IMPORT_CSV" || action === "IMPORT_PROFS") {
      var records = payload.data || payload.records;
      if (!records || !Array.isArray(records)) {
        throw new Error("ไม่พบข้อมูลอาเรย์สำหรับนำเข้า CSV (IMPORT_CSV)");
      }
      
      var existingIds = [];
      var existingEmails = [];
      var existingPersIds = [];
      var idToRowMap = {};
      var emailToRowMap = {};
      var persIdToRowMap = {};
      
      if (lastRow > 1) {
        var allValues = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
        for (var idx = 0; idx < allValues.length; idx++) {
          var rowNum = idx + 2;
          var curId = allValues[idx][0] ? allValues[idx][0].toString().trim() : "";
          var curPersId = allValues[idx][2] ? allValues[idx][2].toString().trim() : "";
          var curEmail = allValues[idx][5] ? allValues[idx][5].toString().trim().toLowerCase() : "";
          
          if (curId) {
            existingIds.push(curId);
            idToRowMap[curId] = rowNum;
          }
          if (curEmail) {
            existingEmails.push(curEmail);
            emailToRowMap[curEmail] = rowNum;
          }
          if (curPersId) {
            existingPersIds.push(curPersId);
            persIdToRowMap[curPersId] = rowNum;
          }
        }
      }
      
      var upsertCount = 0;
      var insertCount = 0;
      
      for (var j = 0; j < records.length; j++) {
        var rec = records[j];
        var rId = rec.id || "";
        var rName = rec.name || "";
        var rPersId = rec.personalId || "";
        var rPosition = rec.position || "";
        var rDept = rec.department || "";
        var rEmail = rec.email ? rec.email.trim().toLowerCase() : "";
        var rPhone = rec.phone || "";
        
        var targetRow = -1;
        
        if (rId && idToRowMap[rId]) {
          targetRow = idToRowMap[rId];
        } else if (rEmail && emailToRowMap[rEmail]) {
          targetRow = emailToRowMap[rEmail];
        } else if (rPersId && persIdToRowMap[rPersId]) {
          targetRow = persIdToRowMap[rPersId];
        }
        
        if (targetRow !== -1) {
          sheet.getRange(targetRow, 1).setValue(rId || sheet.getRange(targetRow, 1).getValue().toString());
          sheet.getRange(targetRow, 2).setValue(rName);
          if (rPersId) sheet.getRange(targetRow, 3).setValue(rPersId);
          if (rPosition) sheet.getRange(targetRow, 4).setValue(rPosition);
          sheet.getRange(targetRow, 5).setValue(rDept);
          sheet.getRange(targetRow, 6).setValue(rEmail);
          if (rPhone) sheet.getRange(targetRow, 7).setValue(rPhone);
          upsertCount++;
        } else {
          var newProfId = rId || "prof-" + new Date().getTime() + "-" + j;
          sheet.appendRow([
            newProfId,
            rName,
            rPersId,
            rPosition,
            rDept,
            rEmail,
            rPhone
          ]);
          insertCount++;
          
          idToRowMap[newProfId] = sheet.getLastRow();
          if (rEmail) emailToRowMap[rEmail] = sheet.getLastRow();
          if (rPersId) persIdToRowMap[rPersId] = sheet.getLastRow();
        }
      }
      
      return responseJson({
        status: "success",
        message: "นำเข้าและประสานข้อมูลบูรณาการ (Upsert) เรียบร้อย: แก้ไขรายการเดิม " + upsertCount + " รายการ, เพิ่มเติมรายการใหม่ " + insertCount + " รายการ",
        upserted: upsertCount,
        inserted: insertCount
      });
    }
    
    if (action === "ADD" || action === "ADD_PROF") {
      // เพิ่มข้อมูลอาจารย์ใหม่ลงแถวล่าสุด
      var profData = payload.professor || payload || {};
      var newId = profData.id || payload.id || "prof-" + new Date().getTime();
      var name = profData.name || payload.name || "";
      var personalId = profData.personalId || payload.personalId || "";
      var position = profData.position || payload.position || "";
      var department = profData.department || payload.department || "";
      var email = profData.email || payload.email || "";
      var phone = profData.phone || payload.phone || "";
      
      sheet.appendRow([newId, name, personalId, position, department, email, phone]);
      
      return responseJson({
        status: "success",
        message: "เพิ่มข้อมูลอาจารย์สำเร็จ",
        data: { id: newId, name: name, personalId: personalId, position: position, department: department, email: email, phone: phone }
      });
    }
    
    if (action === "EDIT" || action === "EDIT_PROF") {
      // แก้ไขข้อมูลแถวเดิมตาม ID ที่ระบุ
      var profData = payload.professor || payload || {};
      var targetId = profData.id || payload.id;
      if (!targetId) throw new Error("ไม่พบรหัสผู้ใช้ ID ในคำสั่งแก้ไข");
      
      var foundRow = -1;
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (ids[i][0].toString() === targetId.toString()) {
            foundRow = i + 2; // คำนวณเลขชี้ของแถวจริงรวม header
            break;
          }
        }
      }
      
      var name = profData.name || payload.name || "";
      var personalId = profData.personalId || payload.personalId || "";
      var position = profData.position || payload.position || "";
      var department = profData.department || payload.department || "";
      var email = profData.email || payload.email || "";
      var phone = profData.phone || payload.phone || "";
      
      if (foundRow !== -1) {
        sheet.getRange(foundRow, 2).setValue(name);
        sheet.getRange(foundRow, 3).setValue(personalId);
        sheet.getRange(foundRow, 4).setValue(position);
        sheet.getRange(foundRow, 5).setValue(department);
        sheet.getRange(foundRow, 6).setValue(email);
        sheet.getRange(foundRow, 7).setValue(phone);
        
        return responseJson({
          status: "success",
          message: "แก้ไขข้อมูลอาจารย์สำเร็จ",
          data: { id: targetId, name: name, personalId: personalId, position: position, department: department, email: email, phone: phone }
        });
      } else {
        // หากไม่เจอแถว ID ให้เพิ่มเข้าไปใหม่
        sheet.appendRow([targetId, name, personalId, position, department, email, phone]);
        return responseJson({
          status: "success",
          message: "ไม่พบข้อมูลเดิม ทำการขึ้นทะเบียนแถวใหม่สำเร็จ"
        });
      }
    }
    
    if (action === "DELETE" || action === "DELETE_PROF") {
      // ลบข้อมูลแถวตาม ID ที่ระบุ จาก Google Sheets
      // ⚠️ กฎเหล็กด้านความปลอดภัยด้านความเป็นส่วนตัว: ห้ามทำการส่งอีเมลแจ้งเตือนใด ๆ ทั้งสิ้นเมื่อทำการลบข้อมูล
      // ห้ามมีคำสั่ง MailApp.sendEmail หรือ GmailApp.sendEmail ในเคสนี้เด็ดขาด ระบบจะทำงานเงียบ ๆ เท่านั้น
      var targetId = payload.id;
      if (!targetId) throw new Error("ไม่พบรหัสผู้ใช้ ID ในคำสั่งลบ");
      
      var foundRow = -1;
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (ids[i][0].toString() === targetId.toString()) {
            foundRow = i + 2;
            break;
          }
        }
      }
      
      if (foundRow !== -1) {
        sheet.deleteRow(foundRow);
        return responseJson({
          status: "success",
          message: "ลบข้อมูลอาจารย์เรียบร้อยแล้ว (ไม่มีการส่งอีเมลแจ้งเตือนใดๆ เพื่อความปลอดภัยสูงสุด)"
        });
      } else {
        throw new Error("ไม่พบข้อมูลอาจารย์ที่มีรหัส ID: " + targetId);
      }
    }
    
    return responseJson({
      status: "error",
      message: "ไม่รู้จัก Action คำสั่งงานที่ร้องขอ"
    });
    
  } catch (error) {
    return responseJson({
      status: "error",
      message: "เกิดข้อผิดพลาดในการประมวลผลคำสั่ง: " + error.toString()
    });
  }
}

/**
 * ฟังก์ชันสำหรับประมวลผลและส่งอีเมลแจ้งผลพิจารณาเอกสารพร้อมปุ่มประเมินความพึงพอใจ 5 ดาว (Pre-filled Google Form)
 * ⚠️ กฎเหล็กความปลอดภัย: ระบบจะส่งอีเมลจากฟังก์ชันนี้เท่านั้น ฟังก์ชันฐานข้อมูลอื่นๆ แอดมินจะไม่ทำการกระตุ้นให้ส่งอีเมลใดๆ
 */
function sendAssessmentEmail(payload) {
  var recipient = payload.recipientEmail || "kittiwat.p@bu.ac.th";
  var subject = "แจ้งผลการพิจารณาเอกสาร " + (payload.docNumber || "-") + " - " + (payload.subject || "-");
  
  // แปลงเนื้อความสลักลายเซ็นต์และรายละเอียดแบบ Plain Text
  var plainText = payload.emailBody || "";
  
  // ออกแบบหน้าเค้าร่าง HTML ที่ตอบรับอุปกรณ์และกล่องดาวประเมิน Pre-filled เพียงลิงก์เดียวที่เสถียรที่สุด
  var htmlBody = 
    '<div style="font-family: \'Sarabun\', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.6; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">' +
      '<!-- Header Banner -->' +
      '<div style="background-color: #003366; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">' +
        '<h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold; font-family: \'Sarabun\', sans-serif;">' +
          'แจ้งผลการพิจารณาเอกสาร / Notification of Document Consideration' +
        '</h2>' +
        '<p style="color: #cbd5e1; margin: 4px 0 0 0; font-size: 11.5px; font-weight:lighter;">' +
          'สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ' +
        '</p>' +
      '</div>' +
      
      '<!-- Content Container -->' +
      '<div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">' +
        '<p style="font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 0;">' +
          'เรียน ' + (payload.senderName || '-') + ' (' + (payload.department || '-') + ')' +
        '</p>' +
        
        '<p style="font-size: 13.5px; color: #334155; margin-bottom: 20px; text-indent: 15px;">' +
          'สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) ขอแจ้งผลการพิจารณาเอกสาร โดยมีรายละเอียดดังต่อไปนี้:' +
        '</p>' +

        '<!-- Table Details -->' +
        '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">' +
          '<tr style="background-color: #f8fafc;">' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">เลขที่อ้างอิง วพ.:</td>' +
            '<td style="padding: 10px 14px; color: #003366; border-bottom: 1px solid #f1f5f9; font-weight: bold; font-family: monospace;">' + (payload.vphRefNo || '-') + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">เลขที่หนังสือต้นทาง:</td>' +
            '<td style="padding: 10px 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">' + (payload.docNumber || '-') + '</td>' +
          '</tr>' +
          '<tr style="background-color: #f8fafc;">' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">เรื่อง / ชื่อโครงการ:</td>' +
            '<td style="padding: 10px 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-weight: bold;">' + (payload.subject || '-') + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">ผลการพิจารณาจาก รอง วพ.:</td>' +
            '<td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">' +
              '<span style="background-color: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 9999px; font-size: 11.5px;">' + (payload.status || 'อนุมัติ') + '</span>' +
            '</td>' +
          '</tr>' +
          '<tr style="background-color: #f8fafc;">' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">วันที่ดำเนินการส่งออก:</td>' +
            '<td style="padding: 10px 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">' + (payload.outgoingDate || '-') + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 10px 14px; font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9;">หน่วยงานปลายทางที่รับช่วงต่อ:</td>' +
            <td style="padding: 10px 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">' + (payload.receiverName || '-') + ' (หน่วยงาน: ' + (payload.outgoingDept || '-') + ')</td>' +
          '</tr>' +
        '</table>' +

        '<p style="font-size: 12px; color: #64748b; line-height: 1.5; font-style: italic; margin-bottom: 25px; padding: 10px 14px; background-color: #fafafa; border-left: 3px solid #cbd5e1;">' +
          '(หมายเหตุ: เอกสารฉบับจริงที่ผ่านการพิจารณาจาก รอง วพ. ได้ดำเนินการจัดส่งต่อให้กับหน่วยงานรับช่วงต่อเสร็จสิ้น เพื่อโปรดดำเนินการในขั้นตอนต่อไปเรียบร้อยแล้ว)' +
        '</p>' +

        '<!-- 📊 Section: Google Form Pre-filled Star Rating -->' +
        '<div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">' +
          '<h3 style="color: #78350f; margin: 0 0 6px 0; font-size: 14px; font-weight: bold;">' +
            '📊 แบบประเมินระดับความพึงพอใจการให้บริการ (วพ. Service Rating)' +
          '</h3>' +
          '<p style="color: #92400e; margin: 0 0 16px 0; font-size: 11.5px;">' +
            'กรุณาคลิกเลือกดาวเพื่อประเมินความพึงพอใจการให้บริการในครั้งนี้<br/>(ระบบจะลิ้งก์ไปยัง Google Form ของสถาบัน โดยทำการระบุแต้มคะแนนล่วงหน้าอย่างรวดเร็วและเสถียรที่สุด)' +
          '</p>' +

          '<table style="width: 100%; max-width: 440px; margin: 0 auto; border-collapse: separate; border-spacing: 6px;">' +
            '<tr>' +
              '<!-- 🤬 1 ดาว -->' +
              '<td style="width: 20%; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 4px; text-align: center; vertical-align: middle;">' +
                '<a href="\' + baseFormUrl + \'1" target="_blank" style="text-decoration: none; display: block;">' +
                  '<span style="font-size: 22px; display: block; margin-bottom: 4px;">🤬</span>' +
                  '<span style="font-size: 10px; font-weight: bold; color: #b45309; display: block; margin-bottom: 4px;">ปรับปรุง</span>' +
                  '<span style="font-size: 12px; color: #be185d; display: block;">★</span>' +
                '</a>' +
              '</td>' +
              '<!-- 🙁 2 ดาว -->' +
              '<td style="width: 20%; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 4px; text-align: center; vertical-align: middle;">' +
                '<a href="\' + baseFormUrl + \'2" target="_blank" style="text-decoration: none; display: block;">' +
                  '<span style="font-size: 22px; display: block; margin-bottom: 4px;">🙁</span>' +
                  '<span style="font-size: 10px; font-weight: bold; color: #b45309; display: block; margin-bottom: 4px;">พอใช้</span>' +
                  '<span style="font-size: 12px; color: #d97706; display: block;">★★</span>' +
                '</a>' +
              '</td>' +
              '<!-- 😐 3 ดาว -->' +
              '<td style="width: 20%; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 4px; text-align: center; vertical-align: middle;">' +
                '<a href="\' + baseFormUrl + \'3" target="_blank" style="text-decoration: none; display: block;">' +
                  '<span style="font-size: 22px; display: block; margin-bottom: 4px;">😐</span>' +
                  '<span style="font-size: 10px; font-weight: bold; color: #b45309; display: block; margin-bottom: 4px;">ปานกลาง</span>' +
                  '<span style="font-size: 12px; color: #eab308; display: block;">★★★</span>' +
                '</a>' +
              '</td>' +
              '<!-- 😊 4 ดาว -->' +
              '<td style="width: 20%; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 4px; text-align: center; vertical-align: middle;">' +
                '<a href="\' + baseFormUrl + \'4" target="_blank" style="text-decoration: none; display: block;">' +
                  '<span style="font-size: 22px; display: block; margin-bottom: 4px;">😊</span>' +
                  '<span style="font-size: 10px; font-weight: bold; color: #b45309; display: block; margin-bottom: 4px;">ดี</span>' +
                  '<span style="font-size: 12px; color: #84cc16; display: block;">★★★★</span>' +
                '</a>' +
              '</td>' +
              '<!-- 🤩 5 ดาว -->' +
              '<td style="width: 20%; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 4px; text-align: center; vertical-align: middle;">' +
                '<a href="\' + baseFormUrl + \'5" target="_blank" style="text-decoration: none; display: block;">' +
                  '<span style="font-size: 22px; display: block; margin-bottom: 4px;">🤩</span>' +
                  '<span style="font-size: 10px; font-weight: bold; color: #6b21a8; display: block; margin-bottom: 4px;">ดีเยี่ยม</span>' +
                  '<span style="font-size: 12px; color: #a855f7; display: block;">★★★★★</span>' +
                '</a>' +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</div>' +

        '<div style="font-size: 13px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 15px;">' +
          '<p style="margin: 0 0 10px 0;">จึงเรียนมาเพื่อโปรดทราบ</p>' +
          '<p style="margin: 0; font-weight: bold; color: #003366;">ขอแสดงความนับถือ</p>' +
          '<p style="margin: 4px 0 0 0; font-weight: bold; color: #1e293b;">สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)</p>' +
          '<p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">มหาวิทยาลัยกรุงเทพ (โทร. 2122 / อีเมล์: kittiwat.p@bu.ac.th)</p>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody,
      body: plainText
    });
    return { status: "success", message: "ส่งอีเมลและแบบประเมินความพึงพอใจผ่าน MailApp เรียบร้อยแล้ว" };
  } catch(e) {
    try {
      GmailApp.sendEmail(recipient, subject, plainText, {
        htmlBody: htmlBody
      });
      return { status: "success", message: "ส่งอีเมลและแบบประเมินความพึงพอใจสำเร็จเรียบร้อยแล้ว (ทางเลือกสำรอง GmailApp)" };
    } catch(err) {
      return { status: "error", message: "ไม่สามารถส่งอีเมลได้เนื่องจากข้อผิดพลาด: " + err.toString() };
    }
  }
}
`;
