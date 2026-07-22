import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  generateTor(procurement: any): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(20).text('Terms of Reference', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Request No: ${procurement.requestNo}`);
    doc.text(`Title: ${procurement.title}`);
    doc.text(`Type: ${procurement.requestType}`);
    doc.text(`Status: ${procurement.status}`);
    const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', THB: '฿', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$', MYR: 'RM', IDR: 'Rp' };
    if (procurement.budgetEstimate)
      doc.text(
        `Budget: ${CURRENCY_SYMBOLS[procurement.currency || 'USD'] || '$'}${Number(procurement.budgetEstimate).toLocaleString()}`,
      );
    doc.moveDown();
    if (procurement.description) {
      doc.fontSize(14).text('Description');
      doc.fontSize(10).text(procurement.description);
      doc.moveDown();
    }
    if (procurement.businessNeed) {
      doc.fontSize(14).text('Business Need');
      doc.fontSize(10).text(procurement.businessNeed);
      doc.moveDown();
    }
    if (procurement.justification) {
      doc.fontSize(14).text('Justification');
      doc.fontSize(10).text(procurement.justification);
    }
    doc.end();
    return doc;
  }

  generateResult(procurement: any, result: any): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(20).text('Procurement Result', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Request No: ${procurement.requestNo}`);
    doc.text(`Title: ${procurement.title}`);
    if (result.winningVendor)
      doc.text(`Winner: ${result.winningVendor.companyName}`);
    if (result.announcementText) {
      doc.moveDown();
      doc.fontSize(14).text('Announcement');
      doc.fontSize(10).text(result.announcementText);
    }
    doc.end();
    return doc;
  }

  generateContract(
    procurement: { requestNo: string; title: string; createdAt: Date },
    result: {
      announcedAt?: Date | null;
      contractSentAt?: Date | null;
      contractSignedAt?: Date | null;
      announcementText?: string | null;
    },
    vendor: { companyName: string },
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(20).text('Contract Agreement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Contract Ref: ${procurement.requestNo}-CT`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text('Parties');
    doc.fontSize(10).text(`Principal: [Organization Name]`);
    doc.text(`Contractor: ${vendor.companyName}`);
    doc.moveDown();
    doc.fontSize(14).text('Scope of Work');
    doc.fontSize(10).text(procurement.title);
    if (procurement.createdAt)
      doc.text(
        `Award Date: ${new Date(procurement.createdAt).toLocaleDateString()}`,
      );
    doc.moveDown();
    if (result.announcementText) {
      doc.fontSize(14).text('Terms & Conditions');
      doc.fontSize(10).text(result.announcementText);
      doc.moveDown();
    }
    doc.fontSize(14).text('Signatures');
    doc.moveDown(2);
    doc
      .fontSize(10)
      .text('_________________________          _________________________');
    doc.text('Principal Representative          Contractor Representative');
    doc.moveDown();
    if (result.contractSentAt)
      doc.text(
        `Contract sent: ${new Date(result.contractSentAt).toLocaleDateString()}`,
      );
    if (result.contractSignedAt)
      doc.text(
        `Contract signed: ${new Date(result.contractSignedAt).toLocaleDateString()}`,
      );
    doc.end();
    return doc;
  }

  generateEvaluation(procurement: any, evaluations: any[]): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50 });
    doc.fontSize(20).text('Evaluation Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Request No: ${procurement.requestNo}`);
    doc.text(`Title: ${procurement.title}`);
    doc.moveDown();
    evaluations.forEach((e) => {
      doc.text(
        `${e.evaluator?.fullName || 'Unknown'} → ${e.vendor?.companyName || 'Unknown'}: ${e.score}/100`,
      );
      if (e.comment) doc.text(`  Comment: ${e.comment}`);
      doc.moveDown(0.5);
    });
    doc.end();
    return doc;
  }
}
