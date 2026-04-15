/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardPaste, 
  Table as TableIcon, 
  LayoutDashboard, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';

// --- Types ---

interface LabRow {
  id: string;
  codigo: string;
  metodo: string;
  tipoAmostra: string;
  identificacao: string;
  dataDistribuicao: string;
  dataEntrega: string;
  dataLimite: string;
  amostrasAnalise: string; // User editable
}

interface DashboardDay {
  date: Date;
  dateStr: string;
  totalRecebido: number;
  dentroPrazo: number;
  atraso: number;
}

// --- Helpers ---

const parseDateBR = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
};

const formatDateBR = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
};

const diffDays = (d1: Date, d2: Date): number => {
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// --- Components ---

export default function App() {
  const [inputText, setInputText] = useState('');
  const [rows, setRows] = useState<LabRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processData = useCallback(() => {
    if (!inputText.trim()) {
      setError('Por favor, cole os dados da planilha primeiro.');
      return;
    }

    try {
      const lines = inputText.trim().split('\n');
      const newRows: LabRow[] = lines.map((line, index) => {
        const columns = line.split('\t');
        
        // Expected columns: Código, Método, Tipo, Identificação, Distribuição, Entrega, Limite
        // We handle cases where there might be fewer columns gracefully
        return {
          id: `${Date.now()}-${index}`,
          codigo: columns[0]?.trim() || '',
          metodo: columns[1]?.trim() || '',
          tipoAmostra: columns[2]?.trim() || '',
          identificacao: columns[3]?.trim() || '',
          dataDistribuicao: columns[4]?.trim() || '',
          dataEntrega: columns[5]?.trim() || '',
          dataLimite: columns[6]?.trim() || '',
          amostrasAnalise: '',
        };
      });

      setRows(newRows);
      setError(null);
      setInputText('');
    } catch (err) {
      setError('Erro ao processar os dados. Verifique se o formato está correto (TAB-separated).');
      console.error(err);
    }
  }, [inputText]);

  const updateAmostrasAnalise = (id: string, value: string) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, amostrasAnalise: value } : row));
  };

  const clearData = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os dados?')) {
      setRows([]);
    }
  };

  // --- Calculations ---

  const processedRows = useMemo(() => {
    return rows.map(row => {
      const dLimite = parseDateBR(row.dataLimite);
      const dDist = parseDateBR(row.dataDistribuicao);
      const dEntrega = parseDateBR(row.dataEntrega);

      // Regra do Recebimento: Limite - Distribuição
      let recebimento = 'N/A';
      let recebimentoStatus: 'ok' | 'error' | 'neutral' = 'neutral';
      if (dLimite && dDist) {
        const diff = diffDays(dLimite, dDist);
        recebimento = diff < 2 ? 'Chegou vencida' : 'OK';
        recebimentoStatus = diff < 2 ? 'error' : 'ok';
      }

      // Regra do Prazo: Entrega - Distribuição
      let prazo = 'N/A';
      let prazoStatus: 'ok' | 'error' | 'neutral' = 'neutral';
      if (dEntrega && dDist) {
        const diff = diffDays(dEntrega, dDist);
        prazo = diff < 6 ? 'Rush' : 'Normal';
        prazoStatus = diff < 6 ? 'error' : 'ok';
      }

      // Regra do Resultado: Amostras em analises == Código
      const resultado = row.amostrasAnalise.trim() === row.codigo.trim() ? 'OK' : 'Verificar';
      const resultadoStatus = row.amostrasAnalise.trim() === row.codigo.trim() ? 'ok' : 'error';

      return {
        ...row,
        recebimento,
        recebimentoStatus,
        prazo,
        prazoStatus,
        resultado,
        resultadoStatus,
        dLimite, // Keep for dashboard
      };
    });
  }, [rows]);

  const dashboardData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DashboardDay[] = [];
    for (let i = 0; i < 8; i++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + i);
      
      const dateStr = formatDateBR(currentDay);
      const dayRows = processedRows.filter(r => {
        if (!r.dLimite) return false;
        const d = new Date(r.dLimite);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === currentDay.getTime();
      });

      const totalRecebido = dayRows.length;
      const dentroPrazo = dayRows.filter(r => r.recebimento === 'OK').length;
      const atraso = totalRecebido - dentroPrazo;

      days.push({
        date: currentDay,
        dateStr,
        totalRecebido,
        dentroPrazo,
        atraso
      });
    }
    return days;
  }, [processedRows]);

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans p-4">
      <div className="max-w-[1200px] mx-auto flex flex-col h-[calc(100vh-32px)]">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-primary-brand uppercase">
              SALA DE CONTROLE ANALÍTICO
            </h1>
            <p className="text-[11px] text-text-muted mt-0.5">
              Última atualização: {new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const today = new Date();
                const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                const d1 = new Date(today);
                const d2 = new Date(today); d2.setDate(today.getDate() + 1);
                const d3 = new Date(today); d3.setDate(today.getDate() + 2);
                
                const example = [
                  `LAB-742\tEspectrometria\tSolo Mineral\tAmostra 01\t${formatDate(today)}\t${formatDate(new Date(today.getTime() + 7*86400000))}\t${formatDate(new Date(today.getTime() + 3*86400000))}`,
                  `LAB-745\tGravimetria\tÁgua Potável\tAmostra 02\t${formatDate(today)}\t${formatDate(new Date(today.getTime() + 4*86400000))}\t${formatDate(new Date(today.getTime() + 1*86400000))}`,
                  `LAB-801\tpH-metria\tEfluente Ind.\tAmostra 03\t${formatDate(d2)}\t${formatDate(new Date(d2.getTime() + 8*86400000))}\t${formatDate(new Date(d2.getTime() + 5*86400000))}`,
                ].join('\n');
                setInputText(example);
              }}
              className="px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:bg-slate-200 rounded border border-border transition-colors uppercase"
            >
              Carregar Exemplo
            </button>
            {rows.length > 0 && (
              <button 
                onClick={clearData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-danger-text hover:bg-danger-bg rounded border border-border transition-colors uppercase"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Section */}
        <section className="mb-4">
          <div className="grid grid-cols-[140px_repeat(8,1fr)] bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Header Row */}
            <div className="contents">
              <div className="p-2 bg-slate-100 border-b border-r border-border text-[11px] font-bold uppercase text-text-muted">DATA</div>
              {dashboardData.map((day, idx) => (
                <div key={idx} className="p-2 bg-slate-100 border-b border-r border-border text-center text-[11px] font-bold text-text-muted">
                  {day.dateStr}
                </div>
              ))}
            </div>
            {/* Total Recebido Row */}
            <div className="contents">
              <div className="p-2 bg-bg border-b border-r border-border text-[11px] font-bold text-text-main">TOTAL RECEBIDO</div>
              {dashboardData.map((day, idx) => (
                <div key={idx} className="p-2 border-b border-r border-border text-center font-mono text-base font-bold">
                  {day.totalRecebido.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
            {/* Dentro do Prazo Row */}
            <div className="contents">
              <div className="p-2 bg-bg border-b border-r border-border text-[11px] font-bold text-text-main">DENTRO DO PRAZO</div>
              {dashboardData.map((day, idx) => (
                <div key={idx} className="p-2 border-b border-r border-border text-center font-mono text-base font-bold text-success-text">
                  {day.dentroPrazo.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
            {/* Atraso Row */}
            <div className="contents">
              <div className="p-2 bg-bg border-r border-border text-[11px] font-bold text-text-main">ATRASO (DIFF)</div>
              {dashboardData.map((day, idx) => (
                <div key={idx} className={`p-2 border-r border-border text-center font-mono text-base font-bold ${day.atraso > 0 ? 'text-danger-text' : 'text-text-muted opacity-30'}`}>
                  {day.atraso.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Input Section */}
        <div className="flex gap-3 mb-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Cole os dados da planilha aqui (Tab Separated Values)...&#10;Ex: C001 [TAB] Cromatografia [TAB] Sólido..."
            className="flex-1 h-20 p-2 font-mono text-[12px] bg-surface border border-border rounded-md focus:ring-1 focus:ring-primary-brand focus:border-primary-brand outline-none transition-all resize-none"
          />
          <button
            onClick={processData}
            className="px-6 bg-primary-brand hover:bg-blue-700 text-white text-[12px] font-bold rounded-md shadow-sm transition-all uppercase whitespace-nowrap"
          >
            PROCESSAR PLANILHA
          </button>
        </div>

        {/* Data Table Section */}
        <div className="flex-1 bg-surface border border-border rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b-2 border-border">
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[90px]">Código</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted">Método</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted">Amostra</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[90px]">Distrib.</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[90px]">Limite</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[110px]">Recebimento</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[110px]">Prazo</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted">Análise (Input)</th>
                  <th className="p-2.5 text-[11px] font-bold uppercase text-text-muted w-[110px]">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-text-muted italic">
                      Aguardando importação de dados...
                    </td>
                  </tr>
                ) : (
                  processedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 text-[12px] font-mono text-text-main truncate">{row.codigo}</td>
                      <td className="p-2 text-[12px] text-text-main truncate">{row.metodo}</td>
                      <td className="p-2 text-[12px] text-text-main truncate">{row.tipoAmostra}</td>
                      <td className="p-2 text-[12px] text-text-muted truncate">{row.dataDistribuicao}</td>
                      <td className="p-2 text-[12px] text-text-muted truncate">{row.dataLimite}</td>
                      
                      {/* Recebimento */}
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                          row.recebimentoStatus === 'error' ? 'bg-danger-bg text-danger-text' : 
                          row.recebimentoStatus === 'ok' ? 'bg-success-bg text-success-text' : 
                          'bg-slate-100 text-text-muted'
                        }`}>
                          {row.recebimento}
                        </span>
                      </td>

                      {/* Prazo */}
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                          row.prazoStatus === 'error' ? 'bg-danger-bg text-danger-text' : 
                          row.prazoStatus === 'ok' ? 'bg-success-bg text-success-text' : 
                          'bg-slate-100 text-text-muted'
                        }`}>
                          {row.prazo}
                        </span>
                      </td>

                      {/* Amostras em Analises (Input) */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.amostrasAnalise}
                          onChange={(e) => updateAmostrasAnalise(row.id, e.target.value)}
                          className="w-full px-1.5 py-1 text-[12px] font-mono bg-white border border-border rounded focus:ring-1 focus:ring-primary-brand outline-none transition-all"
                          placeholder="Digitar..."
                        />
                      </td>

                      {/* Resultado */}
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                          row.amostrasAnalise.trim() === '' ? 'bg-warning-bg text-warning-text' :
                          row.resultadoStatus === 'ok' ? 'bg-success-bg text-success-text' : 
                          'bg-danger-bg text-danger-text'
                        }`}>
                          {row.amostrasAnalise.trim() === '' ? 'Pendente' : row.resultado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
