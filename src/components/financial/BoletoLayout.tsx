import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

interface BoletoLayoutProps {
  invoice: {
    id: string;
    client_name: string;
    amount: number;
    due_date: string;
    bank: string;
  };
  onClose: () => void;
}

const bankLabels: Record<string, string> = {
  sicredi: 'Sicredi',
  caixa: 'Caixa Econômica Federal',
  banco_do_brasil: 'Banco do Brasil',
  inter: 'Banco Inter',
};

const bankCodes: Record<string, string> = {
  sicredi: '748',
  caixa: '104',
  banco_do_brasil: '001',
  inter: '077',
};

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const BoletoLayout = ({ invoice, onClose }: BoletoLayoutProps) => {
  const boletoRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = boletoRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Boleto - ${invoice.client_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 20px; color: #000; }
        .boleto { border: 2px solid #000; padding: 0; max-width: 800px; margin: 0 auto; }
        .boleto-header { display: flex; border-bottom: 2px solid #000; }
        .boleto-bank { flex: 1; padding: 8px 12px; font-size: 18px; font-weight: bold; border-right: 2px solid #000; }
        .boleto-code { padding: 8px 12px; font-size: 18px; font-weight: bold; border-right: 2px solid #000; min-width: 80px; text-align: center; }
        .boleto-line { flex: 2; padding: 8px 12px; font-size: 14px; letter-spacing: 2px; display: flex; align-items: center; }
        .boleto-row { display: flex; border-bottom: 1px solid #000; }
        .boleto-cell { padding: 4px 8px; border-right: 1px solid #000; }
        .boleto-cell:last-child { border-right: none; }
        .boleto-cell label { display: block; font-size: 8px; text-transform: uppercase; color: #555; }
        .boleto-cell span { display: block; font-size: 12px; font-weight: bold; margin-top: 2px; }
        .boleto-cell.flex1 { flex: 1; }
        .boleto-cell.flex2 { flex: 2; }
        .boleto-cell.flex3 { flex: 3; }
        .boleto-barcode { padding: 12px; text-align: center; border-top: 2px solid #000; }
        .boleto-barcode div { height: 50px; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 9px); margin: 0 auto; max-width: 600px; }
        .boleto-instructions { padding: 8px; font-size: 10px; border-bottom: 1px solid #000; min-height: 60px; }
        .boleto-instructions label { font-size: 8px; text-transform: uppercase; color: #555; display: block; margin-bottom: 4px; }
        .cut-line { border-top: 1px dashed #999; margin: 16px 0; position: relative; }
        .cut-line::after { content: '✂'; position: absolute; left: -4px; top: -10px; font-size: 14px; color: #999; }
        @media print { body { padding: 0; } .no-print { display: none !important; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const dueFormatted = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-BR') : '-';
  const fakeBarcode = `${bankCodes[invoice.bank] || '000'}.${Math.random().toString().slice(2, 7)} ${Math.random().toString().slice(2, 7)}.${Math.random().toString().slice(2, 7)} ${Math.random().toString().slice(2, 7)}.${Math.random().toString().slice(2, 7)} ${Math.floor(Math.random() * 10)} ${Math.random().toString().slice(2, 16)}`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-[900px] w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Boleto Bancário</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Imprimir</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-6" ref={boletoRef}>
          {/* Recibo do Pagador */}
          <div style={{ border: '2px solid #000', marginBottom: 0, fontFamily: "'Courier New', monospace", color: '#000', background: '#fff', maxWidth: 800 }}>
            <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
              <div style={{ flex: 1, padding: '8px 12px', fontSize: 18, fontWeight: 'bold', borderRight: '2px solid #000' }}>
                {bankLabels[invoice.bank] || invoice.bank}
              </div>
              <div style={{ padding: '8px 12px', fontSize: 18, fontWeight: 'bold', borderRight: '2px solid #000', minWidth: 80, textAlign: 'center' }}>
                {bankCodes[invoice.bank] || '000'}
              </div>
              <div style={{ flex: 2, padding: '8px 12px', fontSize: 12, letterSpacing: 2, display: 'flex', alignItems: 'center' }}>
                {fakeBarcode}
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 3, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Local de Pagamento</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Vencimento</span>
                <span style={{ fontSize: 13, fontWeight: 'bold' }}>{dueFormatted}</span>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 3, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Beneficiário</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>BRAVO MONITORAMENTO LTDA</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Agência/Código Beneficiário</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>0001 / 12345-6</span>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 1, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Data Documento</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Nº Documento</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>{invoice.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Espécie Doc.</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>DM</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>(=) Valor Documento</span>
                <span style={{ fontSize: 13, fontWeight: 'bold' }}>{formatCurrency(invoice.amount)}</span>
              </div>
            </div>

            <div style={{ padding: '4px 8px', borderBottom: '1px solid #000', minHeight: 40 }}>
              <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Instruções</span>
              <span style={{ fontSize: 10 }}>Não receber após o vencimento. Cobrar multa de 2% e juros de 1% ao mês após o vencimento.</span>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 3, padding: '4px 8px', borderRight: '1px solid #000' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>Pagador</span>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>{invoice.client_name}</span>
              </div>
              <div style={{ flex: 1, padding: '4px 8px' }}>
                <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#555', display: 'block' }}>CPF/CNPJ</span>
                <span style={{ fontSize: 11 }}>-</span>
              </div>
            </div>

            <div style={{ padding: '12px', textAlign: 'center', borderTop: '2px solid #000' }}>
              <div style={{ height: 50, background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 9px)', margin: '0 auto', maxWidth: 600 }} />
              <p style={{ fontSize: 10, marginTop: 4, color: '#555' }}>Linha digitável: {fakeBarcode}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoletoLayout;
