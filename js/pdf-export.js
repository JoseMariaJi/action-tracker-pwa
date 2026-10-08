/**
 * Módulo de exportación a PDF para Registro de Acciones
 * Versión 2: Con desglose de Categorías, filtros combinados y diseño A4 optimizado.
 */

export function generateActionsPDF(logs, actionTypesMap, categoriesMap = {}, options = {}) {
  const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFClass) {
    alert('La librería para generar PDF no está disponible. Por favor, refresca la página.');
    return false;
  }

  const {
    periodTitle = 'Historial de Acciones',
    filterLabel = 'Todas las acciones',
    categoryTitle = 'Todas las categorías',
    filenamePrefix = 'registro_acciones'
  } = options;

  const doc = new jsPDFClass({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Barra superior decorativa en color Indigo
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Título del documento
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('REGISTRO DE ACCIONES', 14, 15);

  // Fecha y hora de generación
  const now = new Date();
  const formattedNow = formatDate(now.getTime()) + ' ' + formatTime(now.getTime());
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Generado: ${formattedNow}`, pageWidth - 14, 15, { align: 'right' });

  // Metadatos del informe
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9.5);
  
  // Fila 1 metadatos
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 14, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(periodTitle, 35, 31);

  doc.setFont('helvetica', 'bold');
  doc.text('Total registros:', pageWidth - 60, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(String(logs.length), pageWidth - 14, 31, { align: 'right' });

  // Fila 2 metadatos
  doc.setFont('helvetica', 'bold');
  doc.text('Categoría:', 14, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(categoryTitle, 35, 37);

  // Fila 3 metadatos
  doc.setFont('helvetica', 'bold');
  doc.text('Acción:', 14, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(filterLabel, 35, 43);

  let startY = 48;

  // Si no hay registros que coincidan
  if (logs.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(11);
    doc.text('No hay acciones registradas para el período y categorías seleccionados.', 14, 58);
    doc.save(`${filenamePrefix}_vacio.pdf`);
    return true;
  }

  // Resumen breve por Acción y Categoría
  const countsByType = {};
  logs.forEach(log => {
    const act = actionTypesMap[log.actionTypeId];
    const actName = act ? act.name : 'Acción no identificada';
    const cat = act && categoriesMap[act.categoryId] ? categoriesMap[act.categoryId].name : 'Genérica';
    const key = `${actName} [${cat}]`;
    countsByType[key] = (countsByType[key] || 0) + 1;
  });

  const summaryRows = Object.entries(countsByType).map(([nameWithCat, count]) => [nameWithCat, String(count)]);

  const callAutoTable = (tableOptions) => {
    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableOptions);
      return doc.lastAutoTable ? doc.lastAutoTable.finalY : null;
    } else if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, tableOptions);
      return doc.lastAutoTable ? doc.lastAutoTable.finalY : null;
    }
    return null;
  };

  // Tabla resumen pequeña si hay varios registros
  if (summaryRows.length > 1) {
    const finalY = callAutoTable({
      startY: startY,
      head: [['Acción y Categoría', 'Frecuencia']],
      body: summaryRows,
      theme: 'grid',
      tableWidth: 100,
      margin: { left: 14 },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    if (finalY) {
      startY = finalY + 8;
    } else {
      startY += 25;
    }
  }

  // Preparar filas con columna de Categoría incluida
  const tableData = logs.map((log, index) => {
    const actionType = actionTypesMap[log.actionTypeId];
    const actionName = actionType ? actionType.name : 'Acción no identificada';
    const catName = actionType && categoriesMap[actionType.categoryId] 
      ? categoriesMap[actionType.categoryId].name 
      : 'Genérica';
    const dateStr = formatDate(log.timestamp);
    const timeStr = formatTime(log.timestamp);
    const notesStr = log.notes ? log.notes : '-';

    return [
      String(index + 1),
      actionName,
      catName,
      dateStr,
      timeStr,
      notesStr
    ];
  });

  // Generar tabla detallada con Categoría
  const tableFinishedY = callAutoTable({
    startY: startY,
    head: [['#', 'Acción', 'Categoría', 'Fecha', 'Hora', 'Notas / Observaciones']],
    body: tableData,
    theme: 'striped',
    margin: { left: 14, right: 14, bottom: 20 },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 'auto' }
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${currentPage} de ${pageCount} — Registro de Acciones PWA`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  // Fallback si autoTable no está disponible
  if (!tableFinishedY) {
    let y = startY + 10;
    doc.setFontSize(8.5);
    tableData.forEach((row) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${row[0]}. ${row[1]} (${row[2]}) | ${row[3]} ${row[4]} | ${row[5]}`, 14, y);
      y += 6.5;
    });
  }

  // Guardar archivo PDF en el navegador del usuario
  const dateTag = now.toISOString().slice(0, 10);
  const finalFilename = `${filenamePrefix}_${dateTag}.pdf`;
  doc.save(finalFilename);
  return true;
}

function formatDate(ts) {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
