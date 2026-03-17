import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CompanyData {
  name: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  razao_social?: string | null;
}

interface QuoteData {
  quote_number: string;
  client_name?: string | null;
  status: string;
  created_at: string;
  valid_until?: string | null;
  discount: number;
  total: number;
  notes?: string | null;
}

interface QuoteItemData {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ClientData {
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateQuotePdf(
  company: CompanyData,
  quote: QuoteData,
  items: QuoteItemData[],
  client?: ClientData | null
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Logo ---
  if (company.logo_url) {
    const logoBase64 = await loadImageAsBase64(company.logo_url);
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, y, 30, 30);
      } catch { /* ignore */ }
    }
  }

  // --- Company header ---
  const companyX = company.logo_url ? 50 : 14;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name || 'Nexus Monitoramento', companyX, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const companyLines: string[] = [];
  if (company.razao_social) companyLines.push(`Razão Social: ${company.razao_social}`);
  if (company.cnpj) companyLines.push(`CNPJ: ${company.cnpj}`);
  if (company.address) companyLines.push(company.address);
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(`Tel: ${company.phone}`);
  if (company.email) contactParts.push(company.email);
  if (contactParts.length) companyLines.push(contactParts.join(' | '));

  companyLines.forEach((line, i) => {
    doc.text(line, companyX, y + 15 + i * 4.5);
  });

  y += Math.max(35, 15 + companyLines.length * 4.5 + 5);

  // --- Divider ---
  doc.setDrawColor(0, 188, 212);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // --- Quote title ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`ORÇAMENTO ${quote.quote_number}`, 14, y);
  y += 7;

  // --- Quote meta ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const metaLeft = [
    `Data: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`,
    `Status: ${STATUS_LABELS[quote.status] || quote.status}`,
  ];
  if (quote.valid_until) metaLeft.push(`Validade: ${new Date(quote.valid_until).toLocaleDateString('pt-BR')}`);
  metaLeft.forEach((line, i) => {
    doc.text(line, 14, y + i * 5);
  });
  y += metaLeft.length * 5 + 5;

  // --- Client data ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Cliente', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const clientName = client?.name || quote.client_name || '-';
  const clientLines: string[] = [`Nome: ${clientName}`];
  if (client?.cpf) clientLines.push(`CPF/CNPJ: ${client.cpf}`);
  if (client?.email) clientLines.push(`E-mail: ${client.email}`);
  if (client?.phone) clientLines.push(`Telefone: ${client.phone}`);
  if (client?.address) clientLines.push(`Endereço: ${client.address}`);

  clientLines.forEach((line, i) => {
    doc.text(line, 14, y + i * 5);
  });
  y += clientLines.length * 5 + 8;

  // --- Items table ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Itens do Orçamento', 14, y);
  y += 4;

  const tableBody = items.map((item, idx) => [
    String(idx + 1),
    item.product_name,
    String(item.quantity),
    `R$ ${Number(item.unit_price).toFixed(2)}`,
    `R$ ${Number(item.total).toFixed(2)}`,
  ]);

  (doc as any).autoTable({
    startY: y,
    head: [['#', 'Produto', 'Qtd', 'Unitário', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 188, 212], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // --- Totals ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const subtotal = items.reduce((s, i) => s + Number(i.total), 0);
  doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
  y += 5;

  if (quote.discount > 0) {
    doc.text(`Desconto: -R$ ${Number(quote.discount).toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
    y += 5;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: R$ ${Number(quote.total).toFixed(2)}`, pageWidth - 14, y, { align: 'right' });
  y += 10;

  // --- Notes ---
  if (quote.notes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 28);
    doc.text(splitNotes, 14, y);
    y += splitNotes.length * 4.5 + 10;
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(130);
  doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, footerY);
  doc.text(company.name || 'Nexus Monitoramento', pageWidth - 14, footerY, { align: 'right' });

  // --- Save ---
  doc.save(`orcamento-${quote.quote_number}.pdf`);
}
