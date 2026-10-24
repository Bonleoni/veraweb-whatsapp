'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Search, User, PanelLeftClose, PanelLeftOpen, Building2 } from 'lucide-react';
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
  lastMessageTime?: string;
}

interface Message {
  id: string;
  customer_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  created_at: string;
}

export default function ConversationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // İşletmeleri yükle
  const loadBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.data);
        if (data.data.length > 0 && !selectedBusiness) {
          setSelectedBusiness(data.data[0]);
        }
      }
    } catch (error) {
      console.error('İşletmeler yüklenemedi:', error);
    }
  };

  // Müşterileri yükle
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

  // Mesajları yükle
  const loadMessages = async (customerId: string) => {
    try {
      const res = await fetch(`/api/messages/history?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  // Mesaj gönder
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
          content: tempMessage
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          id: data.data?.id || Date.now().toString(),
          customer_id: selectedCustomer.id,
          direction: 'outbound',
          content: tempMessage,
          status: 'sent',
          created_at: new Date().toISOString()
        }]);

        await loadCustomers(selectedBusiness?.id);
        toast.success('Mesaj gönderildi');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    loadMessages(customer.id);
  };

  // İlk yükleme
  useEffect(() => {
    loadBusinesses();
  }, []);

  // İşletme seçildiğinde
  useEffect(() => {
    if (selectedBusiness) {
      loadCustomers(selectedBusiness.id);
    }
  }, [selectedBusiness]);

  // Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden">
      {/* Başlık */}
      <div className="mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Mesajlaşma
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Müşterilerinizle WhatsApp mesaj geçmişinizi görüntüleyin
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="gap-2"
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          {sidebarOpen ? 'Daralt' : 'Genişlet'}
        </Button>
      </div>

      {/* 4 Sütunlu Layout */}
      <Card className="flex-1 overflow-hidden flex">
        
        {/* SÜTUN 1: Sol Navigasyon (açılıp kapanabilir) */}
        {sidebarOpen && (
          <div className="w-64 border-r border-zinc-200 bg-zinc-50/50 flex flex-col shrink-0">
            <div className="p-4 border-b border-zinc-200">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Menü
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Building2 className="w-4 h-4" />
                  İşletmeler
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <User className="w-4 h-4" />
                  Müşteriler
                </Button>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* SÜTUN 2: İşletmeler */}
        <div className="w-72 border-r border-zinc-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-200">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Pilates İşletmeleri
            </p>
          </div>
          <ScrollArea className="flex-1">
            {businesses.map((business) => (
              <div
                key={business.id}
                onClick={() => setSelectedBusiness(business)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-zinc-50 ${
                  selectedBusiness?.id === business.id ? 'bg-zinc-50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
                  {business.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-950 truncate">
                    {business.name}
                  </p>
                  {business.owner_name && (
                    <p className="text-xs text-zinc-500 truncate">
                      {business.owner_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* SÜTUN 3: Müşteriler */}
        <div className="w-80 border-r border-zinc-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-200">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Müşteriler {selectedBusiness && `• ${selectedBusiness.name.split(' ')[0]}`}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input placeholder="Müşteri ara..." className="pl-9" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-zinc-50 ${
                  selectedCustomer?.id === customer.id ? 'bg-zinc-50' : ''
                }`}
              >
                <Avatar>
                  <AvatarFallback className="bg-zinc-100 text-zinc-700">
                    {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-zinc-950 truncate">
                      {customer.name}
                    </p>
                    {customer.lastMessageTime && (
                      <span className="text-xs text-zinc-400">
                        {new Date(customer.lastMessageTime).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {customer.lastMessage || 'Henüz mesaj yok'}
                  </p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* SÜTUN 4: Mesajlaşma */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/50">
          {selectedCustomer ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-zinc-100 text-zinc-700">
                      {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm text-zinc-950">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <User className="w-4 h-4" />
                </Button>
              </div>

              {/* Mesajlar */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-2xl ${
                          msg.direction === 'outbound'
                            ? 'bg-emerald-500 text-white rounded-br-sm'
                            : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.direction === 'outbound' ? 'text-emerald-100' : 'text-zinc-400'
                        }`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-zinc-200 bg-white shrink-0">
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
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  Enter ile gönder, Shift+Enter ile yeni satır
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <User className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  Sohbet başlatmak için soldan bir müşteri seçin
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
