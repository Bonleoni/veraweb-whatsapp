'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Search,
  User,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface Business {
  id: string;
  name: string;
  owner_name?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string | null;
}

interface Message {
  id: string;
  customer_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  created_at: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function ConversationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.data);
        if (data.data.length > 0) {
          setSelectedBusiness((prev) => prev ?? data.data[0]);
        }
      }
    } catch (error) {
      console.error('İşletmeler yüklenemedi:', error);
    }
  };

  const loadCustomers = async (businessId?: string) => {
    try {
      const url = businessId
        ? `/api/conversations?businessId=${businessId}`
        : '/api/conversations';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('Müşteriler yüklenemedi:', error);
    }
  };

  const loadMessages = async (customerId: string) => {
    try {
      const res = await fetch(`/api/messages/history?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedCustomer || sending) return;

    setSending(true);
    const tempMessage = messageInput;
    setMessageInput('');

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          content: tempMessage,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.data?.id || Date.now().toString(),
            customer_id: selectedCustomer.id,
            direction: 'outbound',
            content: tempMessage,
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ]);

        await loadCustomers(selectedBusiness?.id);
        toast.success(data.message || 'Mesaj gönderildi');
      } else {
        toast.error(data.error || 'Mesaj gönderilemedi');
        setMessageInput(tempMessage);
      }
    } catch (error) {
      console.error('Gönderim hatası:', error);
      toast.error('Bir hata oluştu');
      setMessageInput(tempMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    loadMessages(customer.id);
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      setSelectedCustomer(null);
      setMessages([]);
      loadCustomers(selectedBusiness.id);
    }
  }, [selectedBusiness]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Her 5 saniyede bir mesajları yenile (gelen mesajlar için)
  useEffect(() => {
    if (!selectedCustomer) return;

    const interval = setInterval(() => {
      loadMessages(selectedCustomer.id);
    }, 5000); // 5 saniye

    return () => clearInterval(interval);
  }, [selectedCustomer]);

  // Her 10 saniyede bir müşteri listesini güncelle
  useEffect(() => {
    if (!selectedBusiness) return;

    const interval = setInterval(() => {
      loadCustomers(selectedBusiness.id);
    }, 10000); // 10 saniye

    return () => clearInterval(interval);
  }, [selectedBusiness]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  return (
    <div className="-m-8 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-white p-8">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Mesajlaşma
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Müşterilerinizle WhatsApp mesaj geçmişinizi görüntüleyin
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="gap-2"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
          {sidebarOpen ? 'Daralt' : 'Genişlet'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden border border-zinc-200 bg-white">
      {/* SÜTUN 1: Navigasyon (açılıp kapanabilir) */}
      {sidebarOpen && (
        <div className="flex w-16 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50">
          <div className="flex justify-center border-b border-zinc-200 p-4">
            <p className="text-xs font-medium uppercase text-zinc-500">Menü</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              <Button variant="ghost" size="icon" className="mb-2 w-full">
                <Building2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="w-full">
                <User className="h-5 w-5" />
              </Button>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* SÜTUN 2 — İşletmeler */}
      <div className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="shrink-0 border-b border-zinc-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Pilates İşletmeleri
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col">
            {businesses.map((business) => (
              <button
                key={business.id}
                type="button"
                onClick={() => setSelectedBusiness(business)}
                className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50 ${
                  selectedBusiness?.id === business.id ? 'bg-zinc-50' : ''
                }`}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white">
                  {initials(business.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950">
                    {business.name}
                  </p>
                  {business.owner_name && (
                    <p className="truncate text-xs text-zinc-500">
                      {business.owner_name}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* SÜTUN 3 — Müşteriler */}
      <div className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="shrink-0 space-y-3 border-b border-zinc-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Müşteriler
            {selectedBusiness ? ` • ${selectedBusiness.name}` : ''}
          </p>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Müşteri ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col">
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
                className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50 ${
                  selectedCustomer?.id === customer.id ? 'bg-zinc-50' : ''
                }`}
              >
                <Avatar>
                  <AvatarFallback className="bg-zinc-100 text-zinc-700">
                    {initials(customer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-950">
                      {customer.name}
                    </p>
                    {customer.lastMessageTime && (
                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatDate(customer.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {customer.lastMessage || 'Henüz mesaj yok'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* SÜTUN 4 — Mesajlaşma */}
      <div className="flex h-full min-w-0 flex-1 flex-col bg-zinc-50/50">
        {selectedCustomer ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white p-4">
              <Avatar>
                <AvatarFallback className="bg-zinc-100 text-zinc-700">
                  {initials(selectedCustomer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">
                  {selectedCustomer.name}
                </p>
                <p className="text-xs text-zinc-500">{selectedCustomer.phone}</p>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 p-4">
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === 'outbound'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'rounded-br-sm bg-emerald-500 text-white'
                          : 'rounded-bl-sm border border-zinc-200 bg-white text-zinc-900'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`mt-1 text-xs ${
                          msg.direction === 'outbound'
                            ? 'text-emerald-100'
                            : 'text-zinc-400'
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-zinc-200 bg-white p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Mesajınızı yazın..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                  className="bg-zinc-950 text-white hover:bg-zinc-800"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <User className="mx-auto mb-3 size-12 text-zinc-300" />
              <p className="text-sm text-zinc-500">
                Sohbet başlatmak için soldan bir müşteri seçin
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
