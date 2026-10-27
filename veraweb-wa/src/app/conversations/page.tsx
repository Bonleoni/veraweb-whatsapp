'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Search,
  User,
  Building2,
  PanelRightClose,
  PanelRightOpen,
  X,
  Phone,
  Mail,
  MapPin,
  Globe,
  Star,
  FileText,
  Smile,
  Paperclip,
  Mic,
  Sparkles,
  Image as ImageIcon,
  File as FileIcon,
  Video,
  Zap,
  ExternalLink,
  Camera,
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
  status?: string | null;
  lastMessage?: string;
  lastMessageTime?: string | null;
}

interface Lead {
  id: string;
  business_name?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  rating?: number | null;
  review_count?: number | null;
  status?: string | null;
  instagram?: string | null;
  instagram_username?: string | null;
  instagram_followers?: number | null;
  instagram_post_count?: number | null;
  instagram_bio?: string | null;
  instagram_profile_pic_url?: string | null;
  photo_urls?: string[] | string | null;
  website?: string | null;
  website_type?: string | null;
  notes?: string | null;
  conversation_status?: 'open' | 'snoozed' | 'done' | null;
}

function parsePhotoUrls(value: Lead['photo_urls']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function getInstagramUsername(lead: Lead): string | null {
  if (lead.instagram_username?.trim()) {
    return lead.instagram_username.replace(/^@/, '').trim();
  }
  if (!lead.instagram) return null;
  const match = lead.instagram.match(
    /instagram\.com\/([A-Za-z0-9._]+)/i
  );
  return match?.[1] ?? null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  // İngilizce
  new: { label: 'Yeni', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacted: {
    label: 'İletişimde',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  interested: {
    label: 'İlgili',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  converted: {
    label: 'Dönüştü',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  rejected: {
    label: 'Reddedildi',
    className: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  },
  // Türkçe
  yeni: { label: 'Yeni', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  iletişimde: {
    label: 'İletişimde',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  iletisimde: {
    label: 'İletişimde',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ilgili: {
    label: 'İlgili',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  dönüştü: {
    label: 'Dönüştü',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  donustu: {
    label: 'Dönüştü',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  reddedildi: {
    label: 'Reddedildi',
    className: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  },
};

const CONVERSATION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  open: {
    label: 'Açık',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  snoozed: {
    label: 'Ertelenen',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  done: {
    label: 'Tamamlanan',
    className: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  },
};

interface Message {
  id: string;
  customer_id?: string;
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  created_at: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
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

function normalizeLeadStatus(status?: string | null) {
  return status?.trim().toLocaleLowerCase('tr-TR') || '';
}

function leadStatusLabel(status?: string | null) {
  const key = normalizeLeadStatus(status);
  if (key && STATUS_CONFIG[key]) return STATUS_CONFIG[key].label;
  return status?.trim() || '';
}

function leadStatusClass(status?: string | null) {
  const key = normalizeLeadStatus(status);
  if (key && STATUS_CONFIG[key]) return STATUS_CONFIG[key].className;
  return 'bg-zinc-50 text-zinc-700 border-zinc-200';
}

function customerStatusLabel(status?: string | null) {
  if (status === 'new') return 'Yeni';
  if (status === 'active') return 'Aktif';
  return status || '';
}

function customerStatusClass(status?: string | null) {
  if (status === 'new') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'active')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-zinc-50 text-zinc-700 border-zinc-200';
}

const QUICK_REPLIES = [
  { id: 'yes', label: 'Evet', content: 'Evet, tabii ki!' },
  { id: 'no', label: 'Hayır', content: 'Hayır, teşekkürler.' },
  {
    id: 'demo',
    label: 'Demo Randevusu',
    content:
      'Size özel bir demo hazırlayabiliriz. Hangi gün ve saat sizin için uygun olur?',
  },
  {
    id: 'price',
    label: 'Fiyat Bilgisi',
    content:
      'Fiyatlandırma hakkında detaylı bilgi gönderiyorum. Bir dakika lütfen.',
  },
  { id: 'thanks', label: 'Teşekkürler', content: 'Teşekkür ederiz!' },
  {
    id: 'callback',
    label: 'Geri Dönüş',
    content: 'Sizi en kısa sürede geri arayacağız.',
  },
];

const COMMON_EMOJIS = [
  '😊',
  '👍',
  '❤️',
  '😂',
  '🎉',
  '🔥',
  '👏',
  '💯',
  '✨',
  '🙏',
  '😍',
  '🥳',
  '👋',
  '💪',
  '🎯',
  '📱',
  '✅',
  '❌',
  '💬',
  '📍',
];

const MESSAGE_TEMPLATES = [
  {
    id: 'intro',
    label: 'Tanıtım',
    content:
      'Merhaba {business_name}! Pilates işletmeleri için WhatsApp üzerinden otomatik ders hatırlatma ve müşteri takibi yapan bir sistem geliştirdik. 2 dakikanızı ayırıp demo gösterebilir miyiz?',
  },
  {
    id: 'follow_up',
    label: 'Takip',
    content:
      'Merhaba {business_name}, daha önce size ulaşmıştık. Sistemimiz hakkında sorularınız var mı? Ücretsiz demo için hazırız.',
  },
  {
    id: 'value_prop',
    label: 'Değer Önerisi',
    content:
      "Merhaba {business_name}, müşterilerinizin %30'u derslerini kaçırıyor. Bizim sistemimizle hatırlatma mesajları göndererek bu oranı %80 azaltabilirsiniz. Detayları konuşalım mı?",
  },
  {
    id: 'demo_invite',
    label: 'Demo Davet',
    content:
      'Merhaba {business_name}, size özel 15 dakikalık bir demo hazırladık. Hangi gün ve saat sizin için uygun olur?',
  },
  {
    id: 'testimonial',
    label: 'Referans',
    content:
      "Merhaba {business_name}, {city}'deki diğer pilates stüdyoları sistemimizi kullanmaya başladı. Siz de katılmak ister misiniz?",
  },
];

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'customers' | 'leads'>('customers');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [conversationFilter, setConversationFilter] = useState<
    'open' | 'snoozed' | 'done'
  >('open');
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter && ['open', 'snoozed', 'done'].includes(filter)) {
      setConversationFilter(filter as 'open' | 'snoozed' | 'done');
    } else {
      setConversationFilter('open');
    }
  }, [searchParams]);

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

  const loadLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) {
        setLeads(data.data);
      }
    } catch (error) {
      console.error('Adaylar yüklenemedi:', error);
    }
  };

  const updateConversationStatus = async (
    status: 'open' | 'snoozed' | 'done',
    leadId?: string
  ) => {
    const targetLeadId = leadId || selectedLead?.id;
    if (!targetLeadId) return;

    const labels = {
      open: 'Açık',
      snoozed: 'Ertelenen',
      done: 'Tamamlanan',
    } as const;

    try {
      const res = await fetch('/api/leads/conversation-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: targetLeadId, status }),
      });

      const data = await res.json();

      if (data.success) {
        setSelectedLead((prev) =>
          prev && prev.id === targetLeadId
            ? { ...prev, conversation_status: status }
            : prev
        );
        setLeads((prev) =>
          prev.map((l) =>
            l.id === targetLeadId ? { ...l, conversation_status: status } : l
          )
        );
        toast.success(`Durum "${labels[status]}" olarak güncellendi`);
      } else {
        toast.error(data.error || 'Güncellenemedi');
      }
    } catch (error) {
      console.error('Durum güncelleme hatası:', error);
      toast.error('Güncellenemedi');
    }
  };

  const loadMessages = async (contactId: string, isLead = false) => {
    try {
      const url = isLead
        ? `/api/messages/history?customerId=${contactId}&isLead=true`
        : `/api/messages/history?customerId=${contactId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);

        if (isLead) {
          const currentStatus =
            selectedLead?.id === contactId
              ? selectedLead.conversation_status || 'open'
              : null;
          if (currentStatus && currentStatus !== 'open') {
            const hasNewInbound = (data.data as Message[] | undefined)?.some(
              (m) =>
                m.direction === 'inbound' &&
                new Date(m.created_at) > new Date(Date.now() - 60000)
            );
            if (hasNewInbound) {
              await updateConversationStatus('open', contactId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  const handleSend = async () => {
    if (!messageInput.trim() || sending) return;

    const targetId =
      mode === 'customers' ? selectedCustomer?.id : selectedLead?.id;
    const targetPhone =
      mode === 'customers' ? selectedCustomer?.phone : selectedLead?.phone;

    if (!targetId || !targetPhone) {
      toast.error('Telefon numarası bulunamadı');
      return;
    }

    setSending(true);
    const tempMessage = messageInput;
    setMessageInput('');

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: targetId,
          content: tempMessage,
          isLead: mode === 'leads',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.data?.id || Date.now().toString(),
            customer_id: targetId,
            direction: 'outbound',
            content: tempMessage,
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ]);

        if (mode === 'customers') {
          await loadCustomers(selectedBusiness?.id);
        }
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchToCustomers = () => {
    setMode('customers');
    setSelectedLead(null);
    setMessages([]);
  };

  const switchToLeads = () => {
    setMode('leads');
    setSelectedCustomer(null);
    setMessages([]);
    loadLeads();
  };

  const modeTabs = (
    <div className="flex h-10 border-b border-zinc-200">
      <Button
        variant={mode === 'customers' ? 'default' : 'ghost'}
        size="sm"
        onClick={switchToCustomers}
        className={`h-10 flex-1 rounded-none text-xs transition-all ${
          mode === 'customers'
            ? 'border-b-2 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
            : 'text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
        }`}
      >
        <User className="mr-1 h-3 w-3" />
        Müşteriler
      </Button>
      <Button
        variant={mode === 'leads' ? 'default' : 'ghost'}
        size="sm"
        onClick={switchToLeads}
        className={`h-10 flex-1 rounded-none text-xs transition-all ${
          mode === 'leads'
            ? 'border-b-2 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
            : 'text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
        }`}
      >
        <Building2 className="mr-1 h-3 w-3" />
        Adaylar
      </Button>
    </div>
  );

  const applyTemplate = (template: (typeof MESSAGE_TEMPLATES)[0]) => {
    let content = template.content;

    if (mode === 'leads' && selectedLead) {
      content = content.replace(
        '{business_name}',
        selectedLead.business_name || 'Değerli İşletme'
      );
      content = content.replace('{city}', selectedLead.city || 'şehrinizdeki');
    } else if (mode === 'customers' && selectedCustomer) {
      content = content.replace(
        '{business_name}',
        selectedCustomer.name || 'Değerli Müşteri'
      );
      content = content.replace('{city}', '');
    }

    setMessageInput(content);
    toast.info('Şablon uygulandı. Göndermeden önce düzenleyebilirsiniz.');
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedLead(null);
    setSelectedCustomer(customer);
  };

  const selectLead = (lead: Lead) => {
    setSelectedCustomer(null);
    setSelectedLead(lead);
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-popup]')) {
        setShowEmojiPicker(false);
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mode === 'customers' && selectedBusiness) {
      setSelectedCustomer(null);
      setMessages([]);
      loadCustomers(selectedBusiness.id);
    }
  }, [selectedBusiness, mode]);

  // Seçili kişi değişince geçmişi yükle
  useEffect(() => {
    if (selectedLead) {
      loadMessages(selectedLead.id, true);
    } else if (selectedCustomer) {
      loadMessages(selectedCustomer.id, false);
    } else {
      setMessages([]);
    }
  }, [selectedLead, selectedCustomer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling — gelen mesajlar için
  useEffect(() => {
    if (!selectedLead && !selectedCustomer) return;

    const interval = setInterval(() => {
      if (selectedLead) {
        loadMessages(selectedLead.id, true);
      } else if (selectedCustomer) {
        loadMessages(selectedCustomer.id, false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedLead, selectedCustomer]);

  useEffect(() => {
    if (mode !== 'customers' || !selectedBusiness) return;

    const interval = setInterval(() => {
      loadCustomers(selectedBusiness.id);
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedBusiness, mode]);

  const filteredCustomers = useMemo(() => {
    if (conversationFilter === 'snoozed' || conversationFilter === 'done') {
      return [];
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery, conversationFilter]);

  const filteredLeads = useMemo(() => {
    const q = leadSearchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (conversationFilter === 'open') {
        if (
          lead.conversation_status !== 'open' &&
          Boolean(lead.conversation_status)
        ) {
          return false;
        }
      } else if (conversationFilter === 'snoozed') {
        if (lead.conversation_status !== 'snoozed') return false;
      } else if (conversationFilter === 'done') {
        if (lead.conversation_status !== 'done') return false;
      }

      if (!q) return true;
      const name = lead.business_name?.toLowerCase() ?? '';
      const contact = lead.name?.toLowerCase() ?? '';
      const phone = lead.phone?.toLowerCase() ?? '';
      return name.includes(q) || contact.includes(q) || phone.includes(q);
    });
  }, [leads, leadSearchQuery, conversationFilter]);

  const activeChat = selectedCustomer || selectedLead;
  const canSend = Boolean(
    messageInput.trim() &&
      !sending &&
      (mode === 'customers'
        ? selectedCustomer?.phone
        : selectedLead?.phone)
  );

  return (
    <div className="-m-4 flex h-[calc(100vh-48px)] flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
        {mode === 'customers' ? (
          <>
            <div className="flex h-full w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
              <div className="flex h-10 shrink-0 items-center border-b border-zinc-200 px-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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

            <div className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
              <div className="shrink-0 border-b border-zinc-200">
                {modeTabs}
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
                    <Input
                      placeholder="Müşteri ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className={`flex w-full items-center gap-3 border-l-4 p-4 text-left transition-all ${
                        selectedCustomer?.id === customer.id
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-transparent hover:bg-zinc-50'
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
                      {customer.status && (
                        <Badge
                          variant="outline"
                          className={`h-5 shrink-0 px-1.5 text-[10px] ${customerStatusClass(customer.status)}`}
                        >
                          {customerStatusLabel(customer.status)}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
            <div className="shrink-0 border-b border-zinc-200">
              {modeTabs}
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Aday ara..."
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col">
                {filteredLeads.map((lead) => {
                  const businessName =
                    lead.business_name?.trim() || 'İsimsiz işletme';
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => selectLead(lead)}
                      className={`flex w-full items-center gap-3 border-l-4 p-4 text-left transition-all ${
                        selectedLead?.id === lead.id
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-transparent hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white">
                        {initials(businessName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {businessName}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {lead.name || lead.phone || 'İletişim bilgisi yok'}
                        </p>
                        {lead.city && (
                          <p className="truncate text-xs text-zinc-400">
                            {lead.city}
                          </p>
                        )}
                      </div>
                      {lead.conversation_status ? (
                        <Badge
                          variant="outline"
                          className={`h-5 shrink-0 px-1.5 text-[10px] ${
                            CONVERSATION_STATUS_CONFIG[
                              lead.conversation_status
                            ]?.className ||
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {CONVERSATION_STATUS_CONFIG[lead.conversation_status]
                            ?.label || lead.conversation_status}
                        </Badge>
                      ) : lead.status ? (
                        <Badge
                          variant="outline"
                          className={`h-5 shrink-0 px-1.5 text-[10px] ${leadStatusClass(lead.status)}`}
                        >
                          {leadStatusLabel(lead.status)}
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    {conversationFilter === 'open'
                      ? 'Açık konuşma yok'
                      : conversationFilter === 'snoozed'
                        ? 'Ertelenen konuşma yok'
                        : conversationFilter === 'done'
                          ? 'Tamamlanan konuşma yok'
                          : 'Henüz aday yok'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/50">
          {activeChat ? (
            <>
              <div className="flex h-10 shrink-0 border-b border-zinc-200 bg-white">
                <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
                  {mode === 'leads' && selectedLead && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant={
                          (selectedLead.conversation_status || 'open') ===
                          'open'
                            ? 'default'
                            : 'ghost'
                        }
                        size="sm"
                        onClick={() => updateConversationStatus('open')}
                        className={`h-7 text-xs ${
                          (selectedLead.conversation_status || 'open') ===
                          'open'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'text-zinc-600'
                        }`}
                      >
                        Açık
                      </Button>
                      <Button
                        variant={
                          selectedLead.conversation_status === 'snoozed'
                            ? 'default'
                            : 'ghost'
                        }
                        size="sm"
                        onClick={() => updateConversationStatus('snoozed')}
                        className={`h-7 text-xs ${
                          selectedLead.conversation_status === 'snoozed'
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'text-zinc-600'
                        }`}
                      >
                        Ertelenen
                      </Button>
                      <Button
                        variant={
                          selectedLead.conversation_status === 'done'
                            ? 'default'
                            : 'ghost'
                        }
                        size="sm"
                        onClick={() => updateConversationStatus('done')}
                        className={`h-7 text-xs ${
                          selectedLead.conversation_status === 'done'
                            ? 'bg-zinc-500 text-white hover:bg-zinc-600'
                            : 'text-zinc-600'
                        }`}
                      >
                        Tamamlanan
                      </Button>
                    </div>
                  )}

                  <div className="flex-1" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={`h-7 gap-1.5 transition-all ${
                      showQuickReplies
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Hızlı Yanıtlar
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContactDetails(!showContactDetails)}
                    className={`h-7 gap-1.5 transition-all ${
                      showContactDetails
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {showContactDetails ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    )}
                    {showContactDetails ? 'Gizle' : 'Detaylar'}
                  </Button>
                </div>

                {showContactDetails && (
                  <div className="flex w-80 shrink-0 items-center justify-between border-l border-zinc-200 px-3">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      Contact Details
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowContactDetails(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-1">
                <div
                  className={`flex min-w-0 flex-1 flex-col ${
                    showContactDetails ? 'border-r border-zinc-200' : ''
                  }`}
                >
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

                {mode === 'leads' && selectedLead && (
                  <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/50 px-4 py-2">
                    <p className="mb-2 text-xs font-medium text-zinc-500">
                      Hızlı Şablonlar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MESSAGE_TEMPLATES.map((template) => (
                        <Button
                          key={template.id}
                          variant="outline"
                          size="sm"
                          onClick={() => applyTemplate(template)}
                          className="h-7 text-xs"
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {showQuickReplies && (
                  <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/50 px-4 py-2">
                    <p className="mb-2 text-xs font-medium text-zinc-500">
                      Hızlı Yanıtlar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_REPLIES.map((reply) => (
                        <Button
                          key={reply.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMessageInput(reply.content);
                            toast.info(`"${reply.label}" şablonu uygulandı`);
                          }}
                          className="h-7 text-xs"
                        >
                          {reply.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="shrink-0 border-t border-zinc-200 bg-white">
                  <div className="flex items-center gap-1 border-b border-zinc-100 px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toast.info('Not özelliği yakında eklenecek')
                      }
                      title="Not Ekle"
                    >
                      <FileText className="h-4 w-4 text-zinc-500" />
                    </Button>

                    <div className="relative" data-popup>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setShowEmojiPicker((open) => !open);
                        }}
                        title="Emoji"
                      >
                        <Smile className="h-4 w-4 text-zinc-500" />
                      </Button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-12 left-0 z-50 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
                          <div className="grid grid-cols-10 gap-1">
                            {COMMON_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-zinc-100"
                                onClick={() => {
                                  setMessageInput((prev) => prev + emoji);
                                  setShowEmojiPicker(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toast.info('GIF özelliği yakında eklenecek')
                      }
                      title="GIF"
                    >
                      <span className="text-[10px] font-bold text-zinc-500">
                        GIF
                      </span>
                    </Button>

                    <div className="relative" data-popup>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setShowEmojiPicker(false);
                          setShowAttachmentMenu((open) => !open);
                        }}
                        title="Dosya Ekle"
                      >
                        <Paperclip className="h-4 w-4 text-zinc-500" />
                      </Button>

                      {showAttachmentMenu && (
                        <div className="absolute bottom-12 left-0 z-50 min-w-[150px] rounded-lg border border-zinc-200 bg-white py-2 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-50"
                            onClick={() => {
                              toast.info('Fotoğraf yükleme yakında');
                              setShowAttachmentMenu(false);
                            }}
                          >
                            <ImageIcon className="h-4 w-4" />
                            Fotoğraf
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-50"
                            onClick={() => {
                              toast.info('Belge yükleme yakında');
                              setShowAttachmentMenu(false);
                            }}
                          >
                            <FileIcon className="h-4 w-4" />
                            Belge
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-50"
                            onClick={() => {
                              toast.info('Video yükleme yakında');
                              setShowAttachmentMenu(false);
                            }}
                          >
                            <Video className="h-4 w-4" />
                            Video
                          </button>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toast.info('Ses kaydı özelliği yakında eklenecek')
                      }
                      title="Ses Kaydı"
                    >
                      <Mic className="h-4 w-4 text-zinc-500" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toast.info('AI asistan yakında eklenecek')
                      }
                      title="AI Asistan"
                    >
                      <Sparkles className="h-4 w-4 text-zinc-500" />
                    </Button>

                    <div className="flex-1" />

                    <Button
                      onClick={handleSend}
                      disabled={!canSend}
                      className="h-8 bg-emerald-500 px-4 text-white hover:bg-emerald-600"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="p-3">
                    <Textarea
                      placeholder="Mesajınızı yazın..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={sending}
                      className="min-h-[100px] w-full resize-none"
                      rows={3}
                    />
                    <p className="mt-2 text-xs text-zinc-400">
                      Enter ile gönder, Shift+Enter ile yeni satır
                    </p>
                  </div>
                </div>
                </div>

                {showContactDetails && (
                  <div className="flex h-full w-80 shrink-0 flex-col overflow-y-auto bg-white">
              <div className="border-b border-zinc-200 p-4">
                <h4 className="mb-2 text-xs font-medium text-zinc-500 uppercase">
                  Contact Lists
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {mode === 'customers' ? 'Müşteri' : 'Aday'}
                  </Badge>
                  {selectedLead?.status && (
                    <Badge
                      variant="outline"
                      className={leadStatusClass(selectedLead.status)}
                    >
                      {leadStatusLabel(selectedLead.status)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="border-b border-zinc-200 p-4">
                <h4 className="mb-3 text-xs font-medium text-zinc-500 uppercase">
                  Contact Information
                </h4>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-950">
                    {mode === 'customers'
                      ? selectedCustomer?.name
                      : selectedLead?.business_name?.trim() ||
                        'İsimsiz işletme'}
                  </p>
                  {(mode === 'leads'
                    ? selectedLead?.phone
                    : selectedCustomer?.phone) && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm text-zinc-950">
                        {mode === 'leads'
                          ? selectedLead?.phone
                          : selectedCustomer?.phone}
                      </span>
                    </div>
                  )}
                  {mode === 'leads' && selectedLead?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm text-zinc-950">
                        {selectedLead.email}
                      </span>
                    </div>
                  )}
                  {mode === 'leads' && selectedLead?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-zinc-400" />
                      <span className="text-sm text-zinc-950">
                        {selectedLead.address}
                      </span>
                    </div>
                  )}
                  {mode === 'leads' &&
                    (selectedLead?.city || selectedLead?.district) && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm text-zinc-950">
                          {[selectedLead?.district, selectedLead?.city]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                </div>
              </div>

              {mode === 'leads' && selectedLead?.rating != null && (
                <div className="border-b border-zinc-200 p-4">
                  <h4 className="mb-2 text-xs font-medium text-zinc-500 uppercase">
                    Google Rating
                  </h4>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    <span className="text-lg font-semibold text-zinc-950">
                      {selectedLead.rating}
                    </span>
                    <span className="text-sm text-zinc-500">
                      ({selectedLead.review_count ?? 0} yorum)
                    </span>
                  </div>
                </div>
              )}

              {mode === 'leads' &&
                selectedLead &&
                (selectedLead.instagram_followers != null ||
                  selectedLead.instagram_post_count != null ||
                  selectedLead.instagram_bio ||
                  selectedLead.instagram_profile_pic_url ||
                  selectedLead.instagram_username ||
                  selectedLead.instagram) && (
                  <div className="border-b border-zinc-200 p-4">
                    <h4 className="mb-3 text-xs font-medium text-zinc-500 uppercase">
                      Instagram Detayları
                    </h4>

                    <div className="mb-3 flex items-center gap-3">
                      {selectedLead.instagram_profile_pic_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedLead.instagram_profile_pic_url}
                          alt="Profile"
                          className="h-12 w-12 rounded-full border-2 border-zinc-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-white">
                          <Camera className="h-6 w-6" />
                        </div>
                      )}
                      {getInstagramUsername(selectedLead) && (
                        <div>
                          <p className="text-sm font-medium text-zinc-950">
                            @{getInstagramUsername(selectedLead)}
                          </p>
                          <a
                            href={
                              selectedLead.instagram ||
                              `https://instagram.com/${getInstagramUsername(selectedLead)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Profili Gör
                          </a>
                        </div>
                      )}
                    </div>

                    {(selectedLead.instagram_followers != null ||
                      selectedLead.instagram_post_count != null) && (
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        {selectedLead.instagram_followers != null && (
                          <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
                            <p className="text-xs text-zinc-500">Takipçi</p>
                            <p className="text-sm font-semibold text-zinc-950">
                              {Number(
                                selectedLead.instagram_followers
                              ).toLocaleString('tr-TR')}
                            </p>
                          </div>
                        )}
                        {selectedLead.instagram_post_count != null && (
                          <div className="rounded-lg border border-pink-200 bg-pink-50 p-2">
                            <p className="text-xs text-zinc-500">Gönderi</p>
                            <p className="text-sm font-semibold text-zinc-950">
                              {selectedLead.instagram_post_count}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedLead.instagram_bio && (
                      <div className="rounded-lg bg-zinc-50 p-3">
                        <p className="mb-1 text-xs text-zinc-500">Biyografi</p>
                        <p className="text-sm text-zinc-950">
                          {selectedLead.instagram_bio}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {mode === 'leads' &&
                selectedLead &&
                parsePhotoUrls(selectedLead.photo_urls).length > 0 && (
                  <div className="border-b border-zinc-200 p-4">
                    <h4 className="mb-3 text-xs font-medium text-zinc-500 uppercase">
                      Fotoğraflar
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {parsePhotoUrls(selectedLead.photo_urls)
                        .slice(0, 9)
                        .map((photo, index) => (
                          <a
                            key={`${photo}-${index}`}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square overflow-hidden rounded-lg border border-zinc-200 transition-colors hover:border-zinc-300"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo}
                              alt={`Photo ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                    </div>
                    {parsePhotoUrls(selectedLead.photo_urls).length > 9 && (
                      <p className="mt-2 text-center text-xs text-zinc-500">
                        +{parsePhotoUrls(selectedLead.photo_urls).length - 9}{' '}
                        daha
                      </p>
                    )}
                  </div>
                )}

              {mode === 'leads' && selectedLead?.website && (
                <div className="border-b border-zinc-200 p-4">
                  <h4 className="mb-2 text-xs font-medium text-zinc-500 uppercase">
                    Website
                  </h4>
                  <a
                    href={
                      selectedLead.website.startsWith('http')
                        ? selectedLead.website
                        : `https://${selectedLead.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 transition-colors hover:bg-blue-100"
                  >
                    <Globe className="h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-blue-900">
                        {selectedLead.website.replace(/^https?:\/\//, '')}
                      </p>
                      {selectedLead.website_type && (
                        <p className="text-xs text-blue-600">
                          {selectedLead.website_type}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-blue-600" />
                  </a>
                </div>
              )}

              <div className="border-b border-zinc-200 p-4">
                <h4 className="mb-2 text-xs font-medium text-zinc-500 uppercase">
                  Notes
                </h4>
                <Textarea
                  key={
                    selectedLead?.id || selectedCustomer?.id || 'notes'
                  }
                  placeholder="Not ekleyin..."
                  className="min-h-[80px] text-sm"
                  defaultValue={selectedLead?.notes || ''}
                />
              </div>

              <div className="p-4">
                <h4 className="mb-2 text-xs font-medium text-zinc-500 uppercase">
                  Automations
                </h4>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-950">
                    AI Chatbot Automation
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Aktif</p>
                </div>
              </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <User className="mx-auto mb-3 size-12 text-zinc-300" />
                <p className="text-sm text-zinc-500">
                  Soldan bir müşteri veya aday seçin
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense
      fallback={
        <div className="-m-4 flex h-[calc(100vh-48px)] items-center justify-center bg-white text-sm text-zinc-500">
          Yükleniyor...
        </div>
      }
    >
      <ConversationsPageContent />
    </Suspense>
  );
}
