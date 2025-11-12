'use client'

import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const CaseDetail = dynamic(() => import('@/components/case-detail'), { ssr: false })

export default function CasePage() {
	const params = useParams<{ id: string }>()
	const id = Array.isArray(params?.id) ? params.id[0] : params?.id
	if (!id) return null
	return <CaseDetail id={id} />
}


