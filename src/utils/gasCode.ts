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
 * ฟังก์ชัน doPost(e) สำหรับรับคำสั่ง เพิ่ม, แก้ไข, ลบ และนำเข้า CSV ข้อมูลอาจารย์ใน Google Sheets
 */
function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action;
    
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
`;
