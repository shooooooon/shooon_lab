import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Github, Twitter } from "lucide-react";

export default function About() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12">
        <article className="prose">
          <h1 className="text-4xl font-serif font-bold mb-8">About</h1>

          <section className="mb-12">
            <h2 className="text-2xl font-serif font-semibold mb-4">
              SHooon Lab について
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              SHooon Lab は、テクノロジー、デザイン、そして日々の思考を記録する個人ブログです。
              長文記事を通じて、深い洞察と発見を共有することを目的としています。
            </p>
            <p className="text-muted-foreground leading-relaxed">
              このブログでは、ソフトウェア開発、UI/UXデザイン、プロダクトマネジメント、
              そして創造性に関するトピックを中心に扱っています。
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-serif font-semibold mb-4">
              コンテンツの特徴
            </h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong className="text-foreground">長文記事</strong> - 
                  深い分析と詳細な解説を含む、読み応えのあるコンテンツ
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong className="text-foreground">シリーズ記事</strong> - 
                  複雑なトピックを複数回に分けて体系的に解説
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong className="text-foreground">リッチメディア</strong> - 
                  図解、ギャラリー、コードサンプルを活用した視覚的な説明
                </span>
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-serif font-semibold mb-4">
              お問い合わせ
            </h2>
            <p className="text-muted-foreground mb-6">
              ご質問、フィードバック、コラボレーションのご提案などがございましたら、
              お気軽にご連絡ください。
            </p>
            <div className="flex flex-wrap gap-4">
              <Card className="flex-1 min-w-[200px]">
                <CardContent className="p-4 flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">contact@example.com</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[200px]">
                <CardContent className="p-4 flex items-center gap-3">
                  <Twitter className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Twitter</p>
                    <p className="font-medium">@shooon_lab</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[200px]">
                <CardContent className="p-4 flex items-center gap-3">
                  <Github className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">GitHub</p>
                    <p className="font-medium">github.com/shooon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-semibold mb-4">
              免責事項
            </h2>
            <p className="text-sm text-muted-foreground">
              このブログに掲載されている情報は、執筆時点での個人的な見解や経験に基づいています。
              内容の正確性については最善を尽くしていますが、情報の利用は自己責任でお願いいたします。
              また、外部リンク先のコンテンツについては責任を負いかねます。
            </p>
          </section>
        </article>
      </div>
    </Layout>
  );
}
