<script setup>
import SectionPanel from '@/components/SectionPanel.vue'
import { folderBlueprint, integrationBlueprint } from '@/data/flowBlueprint'
import {
  mockModulesBlueprint,
  pageBlueprint,
  routeBlueprint,
  sharedComponentBlueprint,
} from '@/data/frontendBlueprint'
import { environmentChecklist, samlBlueprint, samlClaims } from '@/services/samlAuth'
import { mockOperationalQueues } from '../../mocks/operations'
import { personaJourneys } from '../../mocks/personas'
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Documentacao viva"
      title="Como a camada frontend esta organizada nesta fase"
      description="Esta tela funciona como documentacao funcional em runtime: o que existe, quem usa e como a estrutura deve evoluir antes da integracao real."
    >
      <div class="grid gap-4 xl:grid-cols-3">
        <div class="inner-panel p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Jornadas alvo
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="journey in personaJourneys"
              :key="journey.personaId"
              class="rounded-[20px] border border-slate-900/10 bg-white/80 p-4"
            >
              <h3 class="text-lg font-semibold text-slate-950">{{ journey.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ journey.objective }}</p>
              <p class="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Telas base
              </p>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ journey.screens.join(' / ') }}</p>
            </div>
          </div>
        </div>

        <div class="inner-panel p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Estrutura de rotas
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="route in routeBlueprint"
              :key="route.path"
              class="rounded-[20px] border border-slate-900/10 bg-white/80 p-4"
            >
              <p class="font-mono text-sm font-semibold text-slate-950">{{ route.path }}</p>
              <p class="mt-2 text-sm text-slate-600">Owner: {{ route.owner }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ route.purpose }}</p>
            </div>
          </div>
        </div>

        <div class="inner-panel p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Filas mockadas
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="queue in mockOperationalQueues"
              :key="queue.id"
              class="rounded-[20px] border border-slate-900/10 bg-white/80 p-4"
            >
              <p class="text-sm font-semibold text-slate-950">{{ queue.name }}</p>
              <p class="mt-2 text-sm text-slate-600">{{ queue.scope }}</p>
              <div class="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span class="rounded-full bg-slate-100 px-3 py-1">Persona: {{ queue.persona }}</span>
                <span class="rounded-full bg-slate-100 px-3 py-1">SLA: {{ queue.sla }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionPanel>

    <SectionPanel
      eyebrow="Arquitetura"
      title="Blocos de integracao do prototipo"
      description="Aqui fica a vista de alto nivel para plugar frontend, backend Frappe, IA e autenticacao institucional sem misturar responsabilidades."
    >
      <div class="grid gap-4 xl:grid-cols-2">
        <div
          v-for="item in integrationBlueprint"
          :key="item.id"
          class="inner-panel p-5"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {{ item.owner }}
              </p>
              <h3 class="mt-2 text-xl font-semibold text-slate-950">{{ item.name }}</h3>
              <p class="mt-3 text-sm leading-6 text-slate-600">{{ item.description }}</p>
            </div>
            <span class="soft-chip">{{ item.status }}</span>
          </div>
          <div class="mt-4 rounded-[20px] bg-slate-100 px-4 py-3 text-sm text-slate-700">
            Entrega esperada: {{ item.deliverable }}
          </div>
        </div>
      </div>
    </SectionPanel>

    <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <SectionPanel
        eyebrow="Estrutura"
        title="Paginas e componentes planejados"
        description="A organizacao abaixo indica como a base atual deve evoluir para cobrir aluno, operacao e gestao sem recriar o projeto."
      >
        <div class="grid gap-3">
          <div
            v-for="page in pageBlueprint"
            :key="page.area"
            class="inner-panel p-4"
          >
            <p class="text-sm font-semibold text-slate-950">{{ page.area }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">Hoje: {{ page.currentState }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">Proxima etapa: {{ page.nextStep }}</p>
          </div>
        </div>

        <div class="mt-5 inner-panel p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Componentes base
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="item in sharedComponentBlueprint"
              :key="item.name"
              class="rounded-[20px] border border-slate-900/10 bg-white/80 p-4"
            >
              <p class="text-sm font-semibold text-slate-950">{{ item.name }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.purpose }}</p>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="SSO"
        title="Blueprint de autenticacao SAML"
        description="Resumo do que precisa existir para o frontend receber o contexto do aluno sem pedir tudo de novo."
      >
        <div class="grid gap-3">
          <div class="inner-panel p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Identity provider
            </p>
            <p class="mt-2 text-sm font-semibold text-slate-900">{{ samlBlueprint.identityProvider }}</p>
          </div>
          <div class="inner-panel p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Entity ID
            </p>
            <p class="mt-2 break-all text-sm font-semibold text-slate-900">
              {{ samlBlueprint.serviceProviderEntityId }}
            </p>
          </div>
          <div class="inner-panel p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              ACS URL
            </p>
            <p class="mt-2 break-all text-sm font-semibold text-slate-900">
              {{ samlBlueprint.assertionConsumerUrl }}
            </p>
          </div>
          <div class="inner-panel p-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Politica de sessao
            </p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ samlBlueprint.sessionPolicy }}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-3">
          <div
            v-for="claim in samlClaims"
            :key="claim.claim"
            class="inner-panel p-4"
          >
            <p class="text-sm font-semibold text-slate-900">{{ claim.claim }}</p>
            <p class="mt-2 text-sm text-slate-600">Mapeia para: {{ claim.mappedTo }}</p>
            <p class="mt-1 text-sm text-slate-600">Uso: {{ claim.purpose }}</p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Pastas"
        title="Mapa do esqueleto frontend"
        description="Esta organizacao foi criada para facilitar o desenho das telas e a evolucao para integracoes reais."
      >
        <div class="grid gap-3">
          <div
            v-for="item in folderBlueprint"
            :key="item.path"
            class="inner-panel p-4"
          >
            <p class="font-mono text-sm font-semibold text-slate-900">{{ item.path }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.purpose }}</p>
          </div>
        </div>

        <div class="mt-5 inner-panel p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Modulos de mock e documentacao
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="module in mockModulesBlueprint"
              :key="module.module"
              class="rounded-[20px] border border-slate-900/10 bg-white/70 px-4 py-3"
            >
              <p class="font-mono text-sm font-semibold text-slate-900">{{ module.module }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ module.responsibility }}</p>
            </div>
          </div>
        </div>

        <div class="mt-5 inner-panel p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Variaveis esperadas
          </p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="env in environmentChecklist"
              :key="env.key"
              class="rounded-[20px] border border-slate-900/10 bg-white/70 px-4 py-3"
            >
              <p class="font-mono text-sm font-semibold text-slate-900">{{ env.key }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ env.purpose }}</p>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
