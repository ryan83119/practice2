'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight, 
  Calculator, 
  Sparkles, 
  Wallet, 
  Coins,
  ShieldCheck,
  Heart
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  rawExpr: string;
  payer: string;
  splitAmong: string[];
  createdAt: string;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const CURRENCIES = [
  { symbol: 'NT$', name: 'TWD (台幣)' },
  { symbol: '$', name: 'USD (美元)' },
  { symbol: '¥', name: 'JPY (日圓)' },
  { symbol: '€', name: 'EUR (歐元)' },
];

export default function SplitExpertApp() {
  // Initial state: Start clean without default A, B, C members
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState('NT$');
  const [newMemberName, setNewMemberName] = useState('');
  
  // New Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [rawAmountExpr, setRawAmountExpr] = useState('');
  const [selectedPayer, setSelectedPayer] = useState('');
  const [selectedSplitAmong, setSelectedSplitAmong] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedMembers = localStorage.getItem('split_expert_members_v2');
      const savedExpenses = localStorage.getItem('split_expert_expenses_v2');
      const savedCurrency = localStorage.getItem('split_expert_currency_v2');
      if (savedMembers) setMembers(JSON.parse(savedMembers));
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedCurrency) setCurrency(savedCurrency);
    } catch (e) {
      console.error('Failed to load from localStorage', e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('split_expert_members_v2', JSON.stringify(members));
      localStorage.setItem('split_expert_expenses_v2', JSON.stringify(expenses));
      localStorage.setItem('split_expert_currency_v2', JSON.stringify(currency));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [members, expenses, currency]);

  // Ensure default payer / split list valid when members change
  useEffect(() => {
    if (members.length > 0) {
      if (!members.some(m => m.name === selectedPayer)) {
        setSelectedPayer(members[0].name);
      }
      if (selectedSplitAmong.length === 0) {
        setSelectedSplitAmong(members.map(m => m.name));
      }
    } else {
      setSelectedPayer('');
      setSelectedSplitAmong([]);
    }
  }, [members]);

  // Safe arithmetic expression evaluator
  const evaluateMath = (expr: string): number => {
    if (!expr) return 0;
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
    try {
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return typeof result === 'number' && !isNaN(result) ? Number(result.toFixed(2)) : 0;
    } catch {
      return 0;
    }
  };

  const previewAmount = evaluateMath(rawAmountExpr);

  // Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.some(m => m.name === trimmed)) {
      setErrorMsg('成員名稱已存在！');
      return;
    }
    const newM = { id: Date.now().toString(), name: trimmed };
    const updated = [...members, newM];
    setMembers(updated);
    setSelectedSplitAmong([...selectedSplitAmong, trimmed]);
    if (members.length === 0) setSelectedPayer(trimmed);
    setNewMemberName('');
    setErrorMsg('');
  };

  // Delete Member
  const handleDeleteMember = (name: string) => {
    const isUsed = expenses.some(exp => exp.payer === name || exp.splitAmong.includes(name));
    if (isUsed) {
      alert(`無法刪除「${name}」，因為該成員已有相關的支出或分攤紀錄！`);
      return;
    }
    setMembers(members.filter(m => m.name !== name));
    setSelectedSplitAmong(selectedSplitAmong.filter(n => n !== name));
  };

  // Add Expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (members.length === 0) {
      setErrorMsg('請先新增至少一位成員！');
      return;
    }
    if (!expenseTitle.trim()) {
      setErrorMsg('請輸入支出項目名稱');
      return;
    }
    const amount = evaluateMath(rawAmountExpr);
    if (amount <= 0) {
      setErrorMsg('請輸入有效的金額或計算式');
      return;
    }
    if (selectedSplitAmong.length === 0) {
      setErrorMsg('請至少選擇一位分攤人');
      return;
    }

    const newExp: Expense = {
      id: Date.now().toString(),
      title: expenseTitle.trim(),
      amount,
      rawExpr: rawAmountExpr,
      payer: selectedPayer,
      splitAmong: selectedSplitAmong,
      createdAt: new Date().toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    setExpenses([newExp, ...expenses]);
    setExpenseTitle('');
    setRawAmountExpr('');
    setErrorMsg('');
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  // Reset All Data
  const handleReset = () => {
    if (confirm('確定要清除所有成員與記帳資料並重新開始嗎？')) {
      setMembers([]);
      setExpenses([]);
      localStorage.removeItem('split_expert_members_v2');
      localStorage.removeItem('split_expert_expenses_v2');
      localStorage.removeItem('split_expert_currency_v2');
    }
  };

  // Core Debt Simplification Calculation
  const calculateDebts = (): { netBalances: Record<string, number>, settlements: Settlement[] } => {
    const netBalances: Record<string, number> = {};
    members.forEach(m => {
      netBalances[m.name] = 0;
    });

    expenses.forEach(exp => {
      const payer = exp.payer;
      const amount = Number(exp.amount) || 0;
      const splitAmong = exp.splitAmong || [];
      
      if (!payer || splitAmong.length === 0 || amount <= 0) return;

      if (netBalances[payer] !== undefined) {
        netBalances[payer] += amount;
      } else {
        netBalances[payer] = amount;
      }

      const share = amount / splitAmong.length;
      splitAmong.forEach(member => {
        if (netBalances[member] !== undefined) {
          netBalances[member] -= share;
        } else {
          netBalances[member] = -share;
        }
      });
    });

    Object.keys(netBalances).forEach(k => {
      netBalances[k] = Math.round(netBalances[k] * 100) / 100;
    });

    const creditors: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];

    Object.entries(netBalances).forEach(([name, balance]) => {
      if (balance > 0.01) {
        creditors.push({ name, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ name, amount: -balance });
      }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settleAmount = Math.min(debtor.amount, creditor.amount);
      if (settleAmount > 0.01) {
        settlements.push({
          from: debtor.name,
          to: creditor.name,
          amount: Math.round(settleAmount * 100) / 100,
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return { netBalances, settlements };
  };

  const { netBalances, settlements } = calculateDebts();

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2c302e] font-sans antialiased selection:bg-[#dfd8cc]">
      {/* Navigation / Header */}
      <header className="border-b border-[#eae4da] bg-[#f7f3eb]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#d4b2a7]/20 border border-[#d4b2a7]/40 flex items-center justify-center text-[#9c6658] shadow-xs">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-[#3d3832]">分帳專家</span>
              <span className="ml-3 text-xs px-2.5 py-1 rounded-full bg-[#e3dec3]/70 text-[#5f6551] font-semibold tracking-wide">
                Crafted Edition
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="選擇幣別"
              className="text-sm bg-white border border-[#d8d0c2] rounded-xl px-4 py-2 text-[#4a453f] font-medium focus:outline-none focus:ring-2 focus:ring-[#9c6658]/30 shadow-2xs"
            >
              {CURRENCIES.map(c => (
                <option key={c.symbol} value={c.symbol}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-[#7a6f66] hover:text-[#3d3832] bg-white border border-[#d8d0c2] hover:border-[#b8af9f] px-4 py-2 rounded-xl transition-all shadow-2xs font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重新開始</span>
            </button>
          </div>
        </div>
      </header>

      {/* Landing Page Hero Banner */}
      <section className="bg-gradient-to-b from-[#f7f3eb] to-[#faf7f2] py-16 sm:py-24 px-6 sm:px-10 border-b border-[#eae4da]">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e5dfd3]/80 border border-[#d6cfc0] text-[#555a48] text-xs font-bold mb-6 shadow-2xs tracking-wide">
            <Sparkles className="w-4 h-4 text-[#858b73]" />
            極簡美學與智慧最小轉帳次數演算法
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#2d2925] mb-6 leading-tight">
            聚餐旅行，<span className="text-[#9c6658] underline decoration-[#d4b2a7]/40 decoration-wavy decoration-2">毫無壓力地分帳</span>
          </h1>
          <p className="text-lg sm:text-xl text-[#6e6459] max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            捨棄制式冰冷的 AI 介面。我們為您打造溫潤舒適的莫蘭迪手感帳目空間，自動計算每人收支淨額，並極小化轉帳次數。
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#595045]">
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-[#e2dcd0] shadow-xs font-medium">
              <ShieldCheck className="w-4.5 h-4.5 text-[#7b856b]" />
              <span>即時清爽結算</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-[#e2dcd0] shadow-xs font-medium">
              <Calculator className="w-4.5 h-4.5 text-[#9c6658]" />
              <span>支援四則算式輸入</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-[#e2dcd0] shadow-xs font-medium">
              <Heart className="w-4.5 h-4.5 text-[#c29b8c]" />
              <span>純粹溫暖質感</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace with larger spacious frames */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 py-12 space-y-12">
        
        {/* A. 頂部看板 (即時結算區 - 框架放大與質感升級) */}
        <section className="bg-white border border-[#e2dcd0] rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#e5dfd3]/20 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e3dec3]/70 flex items-center justify-center text-[#555a48] shadow-2xs">
                <Wallet className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#2d2925]">最佳轉帳建議與結算看板</h2>
            </div>
            <span className="text-xs px-3.5 py-1.5 rounded-full bg-[#f0eee6] text-[#6e6459] font-semibold tracking-wide">
              即時同步計算
            </span>
          </div>

          {/* Settlements */}
          <div className="mb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8a7f73] mb-4">最佳轉帳路徑（最小化交易次數）</h3>
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 rounded-2xl bg-[#faf7f2] border border-dashed border-[#d8d0c2] text-[#8a7f73] text-sm font-medium">
                <Users className="w-8 h-8 text-[#b8afa3] mb-2" />
                請先於下方新增成員，即可開始自動計算最佳轉帳路徑。
              </div>
            ) : settlements.length === 0 ? (
              <div className="flex items-center justify-center gap-3 p-8 rounded-2xl bg-[#f7f5ef] border border-dashed border-[#d8d0c2] text-[#555a48] font-semibold text-base">
                <CheckCircle2 className="w-6 h-6 text-[#7b856b]" />
                所有款項已結清，目前帳目平衡 🎉
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {settlements.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-[#faf7f2] border border-[#e5dfd5] shadow-2xs hover:border-[#d4c8b8] transition-all">
                    <div className="flex items-center gap-3 font-medium text-[#3d3832]">
                      <span className="px-3 py-1.5 rounded-xl bg-[#eadecf] text-[#5c5044] text-sm font-bold shadow-2xs">{s.from}</span>
                      <ArrowRight className="w-4 h-4 text-[#a39788]" />
                      <span className="px-3 py-1.5 rounded-xl bg-[#dce2db] text-[#4a5548] text-sm font-bold shadow-2xs">{s.to}</span>
                    </div>
                    <span className="text-lg font-black text-[#9c6658]">
                      {currency} {s.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal Balance Overview */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8a7f73] mb-4">個人收支淨額總覽</h3>
            {members.length === 0 ? (
              <div className="text-xs text-[#a39788]">尚無成員資料</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {members.map(m => {
                  const net = netBalances[m.name] || 0;
                  const isPositive = net > 0.01;
                  const isNegative = net < -0.01;
                  return (
                    <div key={m.id} className="p-4.5 rounded-2xl bg-[#faf8f5] border border-[#e5dfd5] text-center shadow-2xs">
                      <div className="font-bold text-[#3d3832] mb-1.5 truncate text-base">{m.name}</div>
                      <div className={`text-base font-black ${isPositive ? 'text-[#5a7356]' : isNegative ? 'text-[#b85c4f]' : 'text-[#8a7f73]'}`}>
                        {isPositive ? `+${currency} ${net.toLocaleString()}` : `${currency} ${net.toLocaleString()}`}
                      </div>
                      <div className="text-[11px] text-[#9c9185] mt-1 font-medium">
                        {isPositive ? '實收 / 應拿回' : isNegative ? '需支付' : '已平衡'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Grid Section: Member Management & Add Expense Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* B. 成員管理區 (Frame expanded & refined) */}
          <section className="bg-white border border-[#e2dcd0] rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#7b856b]" />
                  <h3 className="text-lg font-bold text-[#2d2925]">成員管理</h3>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#f0eee6] text-[#6e6459]">{members.length} 位成員</span>
              </div>

              <form onSubmit={handleAddMember} className="flex gap-2.5 mb-6">
                <input
                  type="text"
                  placeholder="輸入新成員姓名..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 bg-[#faf7f2] border border-[#d8d0c2] rounded-2xl px-4 py-3 text-sm text-[#3d3832] placeholder-[#a39788] focus:outline-none focus:ring-2 focus:ring-[#9c6658]/30"
                />
                <button
                  type="submit"
                  className="bg-[#5f6551] hover:bg-[#4f5443] text-white px-5 py-3 rounded-2xl text-sm font-semibold transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </form>
              {errorMsg && <p className="text-xs font-medium text-[#b85c4f] mb-4">{errorMsg}</p>}

              <div className="flex flex-wrap gap-2.5">
                {members.length === 0 ? (
                  <p className="text-xs text-[#a39788] italic">尚未新增任何成員，請在上列輸入並新增。</p>
                ) : (
                  members.map(m => (
                    <div
                      key={m.id}
                      className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#f7f5ef] border border-[#e0dad0] text-sm font-semibold text-[#3d3832] hover:border-[#b8af9f] transition-all shadow-2xs"
                    >
                      <span>{m.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(m.name)}
                        className="text-[#a39788] hover:text-[#b85c4f] transition-colors p-0.5"
                        title="刪除成員"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-[#f0ece4] text-xs text-[#8a7f73] leading-relaxed font-medium">
              💡 提示：點擊成員右側的刪除按鈕可移除未參與記帳的成員。
            </div>
          </section>

          {/* C. 新增支出表單 (Frame expanded & refined) */}
          <section className="bg-white border border-[#e2dcd0] rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <Receipt className="w-5 h-5 text-[#9c6658]" />
              <h3 className="text-lg font-bold text-[#2d2925]">新增支出記錄</h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7a6f66] mb-2">支出項目名稱</label>
                  <input
                    type="text"
                    placeholder="例如：晚餐、計程車、伴手禮"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full bg-[#faf7f2] border border-[#d8d0c2] rounded-2xl px-4 py-3.5 text-sm text-[#3d3832] placeholder-[#a39788] focus:outline-none focus:ring-2 focus:ring-[#9c6658]/30"
                  />
                </div>

                {/* Amount with arithmetic expression parser */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7a6f66] mb-2">
                    金額 ({currency}) <span className="text-[11px] text-[#9c6658] font-medium lowercase">支援算式 150*2+60</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="例如 150*2+60 或 800/4"
                      value={rawAmountExpr}
                      onChange={(e) => setRawAmountExpr(e.target.value)}
                      className="w-full bg-[#faf7f2] border border-[#d8d0c2] rounded-2xl pl-4 pr-24 py-3.5 text-sm text-[#3d3832] placeholder-[#a39788] focus:outline-none focus:ring-2 focus:ring-[#9c6658]/30 font-bold"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#5f6551] bg-[#e3dec3]/70 px-2.5 py-1 rounded-xl">
                      = {previewAmount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Payer */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7a6f66] mb-2">付款人 (誰先付錢)</label>
                  <select
                    value={selectedPayer}
                    onChange={(e) => setSelectedPayer(e.target.value)}
                    aria-label="選擇付款人"
                    className="w-full bg-[#faf7f2] border border-[#d8d0c2] rounded-2xl px-4 py-3.5 text-sm text-[#3d3832] font-medium focus:outline-none focus:ring-2 focus:ring-[#9c6658]/30"
                  >
                    {members.length === 0 ? (
                      <option value="">請先新增成員</option>
                    ) : (
                      members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Split Among */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#7a6f66]">分攤人 (誰要一起出)</label>
                    <div className="space-x-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong(members.map(m => m.name))}
                        className="text-[#5f6551] hover:underline"
                      >
                        全選
                      </button>
                      <span className="text-[#d8d0c2]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSplitAmong([])}
                        className="text-[#9c6658] hover:underline"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#faf7f2] border border-[#d8d0c2] rounded-2xl p-3 flex flex-wrap gap-2.5 min-h-[52px] max-h-32 overflow-y-auto">
                    {members.length === 0 ? (
                      <span className="text-xs text-[#a39788] italic self-center">請先新增成員</span>
                    ) : (
                      members.map(m => {
                        const isChecked = selectedSplitAmong.includes(m.name);
                        return (
                          <label
                            key={m.id}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                              isChecked ? 'bg-[#e3dec3] text-[#4f5443] border border-[#c9c4b2] shadow-2xs' : 'bg-white text-[#7a6f66] border border-[#e0dad0]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSplitAmong([...selectedSplitAmong, m.name]);
                                } else {
                                  setSelectedSplitAmong(selectedSplitAmong.filter(n => n !== m.name));
                                }
                              }}
                              className="rounded text-[#5f6551] focus:ring-0 w-4 h-4"
                            />
                            {m.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="bg-[#9c6658] hover:bg-[#855448] text-white px-8 py-3.5 rounded-2xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4.5 h-4.5" />
                  新增支出項目
                </button>
              </div>
            </form>
          </section>

        </div>

        {/* D. 支出明細列表 (Frame expanded & refined) */}
        <section className="bg-white border border-[#e2dcd0] rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#d4b2a7]/20 flex items-center justify-center text-[#9c6658]">
                <Receipt className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#2d2925]">支出明細列表</h2>
            </div>
            <span className="text-xs px-3.5 py-1.5 rounded-full bg-[#f0eee6] text-[#6e6459] font-semibold tracking-wide">
              共 {expenses.length} 筆記錄
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-16 text-[#9c9185] bg-[#faf7f2] rounded-2xl border border-dashed border-[#e0dad0]">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#8a7f73]" />
              <p className="text-sm font-semibold text-[#6e6459]">目前尚無任何支出記錄</p>
              <p className="text-xs text-[#a39788] mt-1">請先新增成員並在上方建立您的第一筆分帳紀錄。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {expenses.map(exp => (
                <div key={exp.id} className="p-6 rounded-2xl bg-[#faf7f2] border border-[#e5dfd5] hover:border-[#d4c8b8] transition-all flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-lg text-[#3d3832]">{exp.title}</h4>
                      <span className="text-lg font-black text-[#9c6658]">
                        {currency} {exp.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#6e6459] mb-4 font-medium">
                      <span className="px-2.5 py-1 rounded-xl bg-[#eadecf] text-[#5c5044] font-bold shadow-2xs">
                        付款人: {exp.payer}
                      </span>
                      <span className="text-[#b8af9f]">|</span>
                      <span>分攤人數: {exp.splitAmong.length} 人</span>
                      <span className="text-[#b8af9f]">|</span>
                      <span className="text-[#9c9185]">{exp.createdAt}</span>
                    </div>

                    <div className="text-xs text-[#7a6f66] bg-white border border-[#ede7dc] rounded-xl px-3.5 py-2 mb-4 truncate font-medium">
                      分攤成員: {exp.splitAmong.join(', ')}
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-[#f0ece4]">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="flex items-center gap-1.5 text-xs text-[#b85c4f] hover:text-[#9c4a3f] font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除記錄
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#eae4da] bg-[#f7f3eb] py-10 text-center text-xs text-[#7a6f66]">
        <div className="max-w-6xl mx-auto px-6 space-y-2">
          <p className="font-bold text-[#4a453f] text-sm">分帳專家 Split Expert · 溫暖無壓力的團體帳目管理者</p>
          <p>© {2026} 內建最小化貪婪結算演算法與即時本地持久化。</p>
        </div>
      </footer>
    </div>
  );
}
